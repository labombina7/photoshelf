# Feature: Skeleton shimmer en PhotoGrid y transición suave al cambiar de vista

> Estado: ✅ Desplegada — PR #78 mergeado el 2026-05-30

## Historia de usuario

Como usuario de photoshelf navegando por la biblioteca,
quiero que las fotos aparezcan con una animación de carga en lugar de surgir de golpe,
para percibir la interfaz como fluida y profesional mientras las imágenes se descargan.

---

## Descripción

La Timeline de photoshelf ya tiene un sistema de skeleton shimmer bien implementado: cada foto muestra un placeholder animado mientras carga, y al terminar la descarga aparece con una transición suave. Sin embargo, la **PhotoGrid** (usada en la vista de biblioteca y en la vista de lista de eventos) no tiene este comportamiento — las fotos aparecen abruptamente cuando el navegador termina de descargarlas.

Adicionalmente, el toggle entre la vista "carpetas" y "lista" en la biblioteca produce un parpadeo visual porque el contenido cambia sin transición.

Esta US extiende el patrón existente de skeleton + transición al componente `PhotoGrid` y añade una transición de opacidad al cambio de vista, usando `useTransition` de React (ya importado en `LibraryClient.tsx`) para no bloquear la interacción durante el cambio.

---

## Criterios de aceptación

### Skeleton en PhotoGrid
- [ ] Cada imagen en `PhotoGrid` está envuelta en el patrón `photo-item-wrapper` + `photo-skeleton` ya definido en `globals.css`
- [ ] El skeleton se oculta cuando la imagen ha cargado (evento `onLoad` añade la clase `loaded` al wrapper)
- [ ] El comportamiento es idéntico al ya implementado en `TimelineClient.tsx` (mismo CSS, misma animación shimmer)
- [ ] En conexiones lentas (simuladas con DevTools throttling a "Slow 3G"), el skeleton es visible antes de que aparezca la imagen

### Transición al cambiar de vista
- [ ] Al pulsar el toggle "carpetas" / "lista" en `LibraryClient.tsx`, el área de contenido hace fade-out (opacidad 0) antes del cambio y fade-in (opacidad 1) después
- [ ] La transición dura ≤ 150ms para no percibirse como lenta
- [ ] Se usa `useTransition` de React para marcar el cambio de `viewMode` como no urgente, evitando que la UI quede bloqueada

### Sin regresiones
- [ ] Los thumbnails siguen siendo lazy-loaded (atributo `loading="lazy"` preservado)
- [ ] El tamaño de los contenedores no cambia entre el estado skeleton y el estado cargado (sin layout shift)
- [ ] Los tests existentes de PhotoGrid siguen pasando si los hay

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/PhotoGrid.tsx` | Envolver `<img>` en `photo-item-wrapper` + `photo-skeleton`, añadir `onLoad` |
| `src/app/library/LibraryClient.tsx` | Usar `useTransition` + `opacity` transition al cambiar `viewMode` |
| `src/app/globals.css` | Verificar que `.photo-item-wrapper`, `.photo-skeleton` y la animación shimmer cubren el contexto de PhotoGrid (no solo Timeline) |

---

## Notas técnicas

- El patrón de skeleton en Timeline está en `TimelineClient.tsx` líneas 330-345 — copiar el mismo `div.photo-item-wrapper > [photo-skeleton] + img` con el `onLoad`
- `useTransition` ya está importado en `LibraryClient.tsx` — añadir `startTransition(() => setViewMode(newMode))` y controlar la opacidad con el boolean `isPending`
- No se necesita CSS nuevo si `.photo-item-wrapper` ya aplica a todos los contextos — verificar que el selector no está limitado a `.timeline-grid`

---

## Fuera de alcance (v1)

- Skeleton en la vista de mapa (los marcadores tienen su propio sistema de carga)
- Animación de entrada elemento a elemento (stagger) — añade complejidad sin beneficio claro
- Lazy loading con IntersectionObserver propio (ya lo gestiona el atributo `loading="lazy"` nativo)
