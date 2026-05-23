# Feature: Mejoras UX mobile — swipe, bottom sheet y responsive

## Historia de usuario

Como fotógrafo que usa photoshelf desde el móvil,
quiero poder navegar entre fotos con gestos de deslizamiento y ver los metadatos sin scrolls interminables,
para tener una experiencia fluida y natural en pantallas pequeñas.

---

## Descripción

photoshelf funciona en mobile pero no aprovecha los patrones de interacción táctil. La navegación entre fotos en el detalle usa botones, no gestos. El panel de metadatos (`DetailPanel`) ocupa toda la pantalla en móvil y al tener muchos tags o temáticas requiere scroll excesivo. El topbar en móvil tiene demasiados elementos compitiendo por espacio, y el gráfico de estadísticas mensuales tiene 12 columnas fijas ilegibles en pantallas estrechas.

Esta US trata las cuatro mejoras mobile identificadas en el UX audit que comparten el mismo contexto técnico (media queries, touch events, adaptaciones de layout).

---

## Criterios de aceptación

### Swipe horizontal entre fotos en detalle
- [ ] En la vista de detalle (`/library/[photoId]`), detectar gestos de swipe horizontal con `touchstart` + `touchend`
- [ ] Un swipe de más de 50px hacia la izquierda navega a la foto siguiente (si existe)
- [ ] Un swipe de más de 50px hacia la derecha navega a la foto anterior (si existe)
- [ ] El swipe vertical sigue funcionando para hacer scroll normal
- [ ] El área de la foto tiene `touch-action: pan-y` para no bloquear el scroll vertical
- [ ] El gesto funciona en iOS Safari y Chrome Android

### Bottom sheet del DetailPanel en mobile
- [ ] En viewports ≤768px, el `DetailPanel` se muestra como un bottom sheet que por defecto está colapsado mostrando solo la primera sección (nombre de archivo y fecha)
- [ ] Un handle visual (barra horizontal) indica que el panel es expandible
- [ ] Tocar el handle o deslizar hacia arriba expande el panel al 80% de la altura de pantalla
- [ ] Deslizar hacia abajo colapsa el panel
- [ ] En desktop, el panel lateral sigue siendo igual (sin cambios)

### Topbar search en mobile
- [ ] En mobile (≤768px), el campo de búsqueda está colapsado por defecto como un icono de lupa
- [ ] Al tocar el icono, el campo se expande a full-width con animación (reemplaza el título temporalmente)
- [ ] El input tiene `aria-label="Buscar fotos"`
- [ ] Presionar Escape o hacer blur colapsa el campo de búsqueda de nuevo

### Stats grid mensual responsive
- [ ] En viewports ≤768px, el `.stats-month-grid` muestra dos filas de 6 meses (`grid-template-columns: repeat(6, 1fr)`) en lugar de 12 columnas en una fila
- [ ] O alternativamente, las etiquetas de mes se reducen a la inicial (E, F, M, A, M, J, J, A, S, O, N, D)
- [ ] El texto de los valores de cada mes sigue siendo legible en pantallas de 375px

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/library/[photoId]/page.tsx` | Añadir listeners de touch para swipe navigation |
| `src/components/DetailPanel.tsx` | Bottom sheet pattern en mobile con handle y animación |
| `src/app/library/LibraryClient.tsx` | Search expandible en mobile |
| `src/app/globals.css` | Media queries para bottom sheet, search expandible, stats grid |
| `src/app/stats/StatsClient.tsx` | Labels de meses adaptativos para mobile |

---

## Notas técnicas

- Para el swipe, usar `useRef` para almacenar `touchStartX` y calcular el delta en `touchEnd`. No usar librerías externas de gestos para mantener el bundle pequeño.
- El bottom sheet puede implementarse con CSS transforms (`translateY`) controlados por estado React, sin librerías. La animación usa `transition: transform 0.3s ease`.
- Para la búsqueda expandible en mobile, el estado `searchExpanded` (boolean) puede vivir en `LibraryClient`. Al expandirse, hacer `focus()` al input automáticamente.
- El gráfico de estadísticas ya tiene los datos; solo es necesario adaptar el CSS y los labels. No requiere cambios en la lógica de datos.
- Verificar que el swipe no entre en conflicto con el zoom pinch-to-zoom del navegador (usar `touch-action: pan-y` en el contenedor de la imagen).

---

## Fuera de alcance (v1)

- Swipe en el timeline o en la galería de tags
- Gesto de pinch-to-zoom sobre la foto en detalle
- Navegación completa del sidebar en mobile con gestos
- App shell nativa (PWA) con gestures del sistema operativo
