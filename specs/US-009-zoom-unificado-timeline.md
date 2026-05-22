# Feature: Zoom unificado en la vista Timeline

## Historia de usuario

Como fotógrafo navegando mi biblioteca por el timeline,
quiero que el selector de agrupación temporal (Año / Mes / Día) también controle el tamaño visual de las miniaturas,
para tener una sola palanca de zoom intuitiva y no tener que ajustar dos controles independientes.

---

## Descripción

Actualmente la vista Timeline tiene dos controles separados en la topbar:

1. **Zoom temporal** — botones Año / Mes / Día (más +/− para cambiar entre niveles)
2. **Zoom visual** — cinco puntos que ajustan el tamaño de las miniaturas y el número de columnas del grid

Esto crea fricción: el usuario tiene que coordinar dos controles para obtener la vista que quiere. Conceptualmente, "ver el año" ya implica querer ver muchas fotos pequeñas, y "ver el día" implica querer explorar fotos grandes con detalle.

Esta US unifica ambos controles en uno solo. Seleccionar un nivel temporal establece automáticamente el preset visual correspondiente:

| Nivel | Columnas (desktop) | Tamaño thumbnail | Sensación |
|---|---|---|---|
| Año | 10 | 100 px | Vista de pájaro, máxima densidad |
| Mes | 5 | 200 px | Vista equilibrada (actual por defecto) |
| Día | 2 | 420 px | Vista detalle, máxima calidad |

Los botones +/− que flanqueaban al selector temporal desaparecen. El único control que queda son los tres botones de nivel (Año / Mes / Día).

El ajuste fino por teclado (+/−) y Ctrl+scroll se mantienen como atajos de poder para usuarios avanzados, permitiendo desplazarse un nivel sin tocar el ratón.

---

## Criterios de aceptación

### Control unificado en la topbar
- [ ] La topbar del timeline muestra únicamente los tres botones de nivel: **Año**, **Mes**, **Día**
- [ ] Los botones +/− que rodeaban al selector temporal se eliminan
- [ ] El bloque de zoom visual (puntos + botones +/−) se elimina completamente de la topbar
- [ ] El botón activo muestra el estado seleccionado con el estilo `.active` existente

### Sincronización automática nivel ↔ zoom visual
- [ ] Al seleccionar **Año**, el grid pasa a `timeline-grid--z1` y el tamaño de thumbnail es 100 px
- [ ] Al seleccionar **Mes**, el grid pasa a `timeline-grid--z3` y el tamaño de thumbnail es 200 px
- [ ] Al seleccionar **Día**, el grid pasa a `timeline-grid--z5` y el tamaño de thumbnail es 420 px
- [ ] El `limit` de fotos por página se adapta al preset visual correspondiente (120 / 60 / 24)
- [ ] El cambio de nivel aplica inmediatamente sin animación entrecortada

### Atajos de teclado y gestos
- [ ] `Ctrl+scroll` hacia arriba → nivel anterior (Día → Mes → Año)
- [ ] `Ctrl+scroll` hacia abajo → nivel siguiente (Año → Mes → Día)
- [ ] Las teclas `+` / `=` avanzan al siguiente nivel (Año → Mes → Día)
- [ ] La tecla `−` retrocede al nivel anterior (Día → Mes → Año)
- [ ] Doble tap en mobile alterna entre Mes y Día (comportamiento existente, se mantiene)

### Persistencia
- [ ] El nivel seleccionado se persiste en `sessionStorage` con la clave existente `photoshelf_timeline_level`
- [ ] La clave `timeline_zoom_visual` deja de escribirse (el zoom visual ya no es independiente)

### Mobile y responsive
- [ ] Los tres botones de nivel caben en la topbar mobile sin overflow
- [ ] En mobile, las clases de grid responsive existentes siguen aplicándose según el nivel activo
  (`z1` → 6 cols, `z3` → 3 cols, `z5` → 1 col en móvil)

---

## Componentes nuevos o modificados

| Componente | Cambio |
|---|---|
| `src/app/timeline/TimelineClient.tsx` | Eliminar estado `visualZoom` independiente; derivar zoom visual del `level`; eliminar controles VZ de la topbar; actualizar atajos de teclado |
| `src/app/globals.css` | Eliminar estilos `.timeline-zoom-sep`, `.timeline-vz-controls`, `.timeline-vz-dots`, `.timeline-vz-dot` (ya no se usan) |

---

## Notas técnicas

El mapeo nivel → zoom visual se puede expresar como una constante:

```typescript
const LEVEL_ZOOM: Record<Level, number> = {
  year:  1,  // z1 — 10 cols, size 100, limit 120
  month: 3,  // z3 — 5 cols,  size 200, limit 60
  day:   5,  // z5 — 2 cols,  size 420, limit 24
};
```

El estado `visualZoom` se elimina y se reemplaza por `const visualZoom = LEVEL_ZOOM[level]`.
El `useEffect` que persistía `timeline_zoom_visual` en `sessionStorage` también se elimina.

Los atajos +/− y `Ctrl+scroll` pasan a llamar a `setLevel` (no `setVisualZoom`), avanzando o retrocediendo en el array `LEVELS`.

---

## Fuera de alcance (v1)

- Ajuste fino de zoom visual independiente del nivel temporal (quedó descartado por diseño)
- Niveles intermedios tipo "semana" o "trimestre"
- Animación de transición entre presets (las clases CSS de transición existentes son suficientes)
