# Feature: Optimización de carga de miniaturas en la vista Timeline

> **Estado: ✅ Desplegada** — merged en main el 2026-05-22 (PR #26)

## Historia de usuario

Como fotógrafo con una biblioteca grande de miles de imágenes,
quiero que las miniaturas del timeline se carguen de forma progresiva y sin interrupciones visuales
para poder navegar fluidamente por mis recuerdos sin ver celdas en blanco ni esperas bloqueantes.

---

## Descripción

La vista de timeline ya implementa scroll infinito por cursor y `loading="lazy"` en cada `<img>`,
pero la experiencia de carga actual tiene varias fricciones:

1. **Celdas en blanco visibles** — cuando las miniaturas no están en caché de disco (`data/.cache/`),
   el navegador muestra celdas vacías hasta que `sharp` genera el WebP por primera vez. No hay
   ningún indicador visual de que algo está cargando.
2. **Flood de requests al cambiar zoom visual** — al pasar de zoom 3 → 4, todos los `<img>` visibles
   piden simultáneamente `/api/photos/{id}/thumbnail?size=300` (nuevo tamaño), reemplazando las
   peticiones de `size=200` en vuelo o recién completadas.
3. **Sin priorización de imágenes above-the-fold** — las primeras imágenes visibles (LCP candidates)
   no tienen `fetchpriority="high"`, por lo que el navegador las trata igual que las del fondo de la página.
4. **Sin prefetch de la siguiente página** — el sentinel del `IntersectionObserver` está a `400px`
   del borde, lo que puede no ser suficiente en conexiones lentas; tampoco hay prefetch explícito
   de los thumbnails de la siguiente página cuando el usuario está cerca del final.
5. **Generación on-demand bloqueante** — si la caché está fría (primer acceso, o cambio de `size`),
   el servidor genera el WebP de cada thumbnail en la petición HTTP, sin ninguna cola de precalentamiento.

---

## Criterios de aceptación

### Skeleton screens y placeholders
- [ ] Mientras una miniatura está pendiente de carga, la celda muestra un placeholder gris animado
  (`background: shimmer` con CSS animation) del mismo tamaño que la imagen final
- [ ] El placeholder desaparece con una transición suave (`opacity: 0 → 1`) cuando la imagen carga
- [ ] Si la imagen falla (`onError`), en lugar de ocultar la celda (`display: none`) se muestra
  un icono de foto rota con fondo neutro, manteniendo la cuadrícula intacta

### Priorización de imágenes (LCP / Core Web Vitals)
- [ ] Las primeras N imágenes visibles al cargar la página (primer grupo completo) reciben
  `fetchpriority="high"` para favorecer su descarga temprana
- [ ] Las imágenes fuera del viewport inicial mantienen `loading="lazy"` sin `fetchpriority`
- [ ] El número N de imágenes priorizadas se calcula en función del zoom visual activo
  (p. ej. `vzConfig.limit / 3` filas × columnas del grid)

### Gestión del zoom visual sin flood de requests
- [ ] Al cambiar el nivel de zoom visual, se introduce un debounce de ~200 ms antes de actualizar
  el atributo `src` de los `<img>`, evitando que un clic rápido (p. ej. 1 → 5) dispare 4 rondas
  de peticiones para los tamaños intermedios
- [ ] Los `<img>` que ya tenían su thumbnail cargado al tamaño anterior mantienen visible esa imagen
  durante la transición (no se muestra el placeholder de nuevo hasta que la nueva resolución esté lista)

### Ampliación del margen de prefetch
- [ ] El `rootMargin` del `IntersectionObserver` de scroll infinito se amplía a al menos `800px`
  para páginas con conexión lenta (o se adapta dinámicamente con la Network Information API si está disponible)
- [ ] Una vez que se fetcha el siguiente bloque de metadatos de fotos (`fetchMore`), se crea de forma
  proactiva un `<link rel="prefetch">` por cada thumbnail del primer grupo de la nueva página,
  adelantando la generación/descarga antes de que el usuario llegue a esas celdas

### Métricas de rendimiento
- [ ] En una biblioteca con 5 000+ fotos y caché fría, el tiempo hasta primera imagen visible (LCP)
  es < 1,5 s en una conexión de 10 Mbps
- [ ] Al cambiar de zoom visual, la primera fila de imágenes a la nueva resolución aparece en < 1 s
  (caché caliente de disco)
- [ ] No se producen más de `columnas × 3` peticiones HTTP simultáneas al cargar un nuevo bloque
  (throttling natural del navegador es suficiente; no se requiere queue manual salvo regresión medida)

---

## Notas técnicas

### Estado actual del código (referencia)

```tsx
// TimelineClient.tsx — renderizado actual de cada miniatura
<img
  src={`/api/photos/${photo.id}/thumbnail?size=${vzConfig.size}`}
  alt={photo.filename}
  loading="lazy"
  decoding="async"
  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
/>
```

Los tamaños por nivel de zoom son: `100 | 150 | 200 | 300 | 420` px (definidos en `VISUAL_ZOOM_CONFIG`).

El thumbnail se genera en `src/lib/thumbnail.ts` con `sharp` + WebP al 80% de calidad, y se cachea
en `data/.cache/{md5(path:size:fit)}.webp`. La respuesta lleva `Cache-Control: public, max-age=31536000, immutable`.

### Implementación sugerida — skeleton

```tsx
// Añadir estado por imagen o usar CSS puro con :not([src]) / aspect-ratio
<div className="photo-item-wrapper">
  <div className="photo-skeleton" />   {/* visible hasta que img cargue */}
  <img
    src={`/api/photos/${photo.id}/thumbnail?size=${vzConfig.size}`}
    alt={photo.filename}
    loading="lazy"
    decoding="async"
    fetchPriority={isPriority ? 'high' : 'auto'}
    onLoad={e => (e.currentTarget.previousElementSibling as HTMLElement).style.display = 'none'}
    onError={e => { /* mostrar icono roto */ }}
  />
</div>
```

### Implementación sugerida — debounce de zoom visual

```tsx
// En TimelineClient.tsx, separar el zoom "UI" del zoom "aplicado a srcs"
const [pendingZoom, setPendingZoom] = useState(visualZoom);
const appliedZoom = useDebounce(pendingZoom, 200); // hook simple con useEffect + setTimeout
// usar appliedZoom para el src de los <img>
// usar pendingZoom para los controles de UI (dots activos, disabled states)
```

### Prefetch del siguiente bloque

```tsx
// Después de setAllPhotos en fetchMore:
const nextGroupPhotos = incoming.slice(0, vzConfig.limit / 3); // aprox. primera fila
nextGroupPhotos.forEach(photo => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = `/api/photos/${photo.id}/thumbnail?size=${vzConfig.size}`;
  document.head.appendChild(link);
});
```

### CSS para skeleton shimmer

```css
.photo-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Fuera de alcance

- Precalentamiento de caché en background al arrancar el servidor (warmup job)
- Soporte de `srcset` / `sizes` para pantallas HiDPI (retina) — requeriría dobles los tamaños en `VISUAL_ZOOM_CONFIG`
- Virtualización del DOM (react-window / virtual scroll) — no necesaria hasta ~10 000 imágenes en pantalla simultáneas
- Service Worker para caché offline de thumbnails
- Progressive JPEG / LQIP (Low Quality Image Placeholder) generado por `sharp` — evaluar si el shimmer es suficiente
