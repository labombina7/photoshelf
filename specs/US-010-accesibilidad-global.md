# Feature: Accesibilidad global — teclado, screen readers y focus visible

## Historia de usuario

Como usuario de photoshelf que navega con teclado o usa un lector de pantalla,
quiero que todos los controles sean alcanzables, anunciados correctamente y visibles al recibir foco,
para poder usar la aplicación sin depender del ratón.

---

## Descripción

photoshelf carece de capa de accesibilidad funcional: ningún botón de icono tiene `aria-label`, no existe ninguna regla `:focus-visible` global, y varios controles interactivos son `<div>` sin rol semántico. Esto bloquea completamente el uso con teclado y lectores de pantalla (NVDA, VoiceOver, etc.), violando WCAG 2.1 criterios 1.3.1 (Info and Relationships), 2.1.1 (Keyboard) y 2.4.7 (Focus Visible).

Esta US agrupa todos los cambios de accesibilidad que se resuelven con el mismo tipo de intervención: añadir atributos ARIA, convertir divs interactivos en elementos semánticos, y definir estilos de foco visibles. La mayoría son cambios de 1-5 líneas en cada archivo.

Los modales (review, nuevo proyecto) merecen atención especial: al abrirse deben capturar el foco y no permitir que el teclado "escape" al contenido de fondo (focus trap). Este patrón se implementa una sola vez como hook reutilizable.

---

## Criterios de aceptación

### Focus visible global
- [ ] `globals.css` incluye la regla `:focus-visible { outline: 2px solid var(--tag-auto-color); outline-offset: 2px; }` para botones, inputs y elementos interactivos
- [ ] Ningún componente sobreescribe `outline: none` sin ofrecer un estilo alternativo de foco visible
- [ ] La regla aplica en todos los inputs de búsqueda, año, tag y formularios

### Botones hamburger (6 archivos)
- [ ] Todos los `<button className="hamburger">` en `LibraryClient.tsx`, `TimelineClient.tsx`, `StatsClient.tsx`, `ProjectsClient.tsx`, `TagsClient.tsx`, `TagPhotosClient.tsx` tienen `aria-label="Abrir menú de navegación"`
- [ ] Todos tienen `aria-expanded={mobileSidebarOpen}` para indicar el estado del sidebar

### DetailPanel — botones de acción
- [ ] El botón favorito (`★`) tiene `aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}` y `aria-pressed={isFavorite}`
- [ ] El botón de añadir tag (`+`) tiene `aria-label="Añadir etiqueta"`
- [ ] Cada botón de eliminar tag tiene `aria-label={\`Eliminar etiqueta ${tag.name}\`}`

### Sidebar — botones de icono y controles
- [ ] Los botones de editar y eliminar temáticas tienen `aria-label="Editar temática"` / `aria-label="Eliminar temática"` (además del `title` existente)
- [ ] Son focusables con teclado incluso cuando no están en hover (añadir `focus-within` al contenedor `.sidebar-item` para mostrarlos)
- [ ] El botón de cerrar sesión tiene `aria-label="Cerrar sesión"`
- [ ] La acción "Nueva temática" (actualmente `<div onClick>`) se cambia a `<button>` o tiene `role="button" tabIndex={0} onKeyDown` para activar con Enter/Space

### DetailPanel — theme-item semántico
- [ ] Los `<div className="theme-item" onClick>` se convierten en `<button role="checkbox" aria-checked={assignedThemeIds.has(theme.id)} aria-label={\`Temática ${theme.name}\`}>`
- [ ] Son focusables con Tab y activables con Space/Enter

### Modales — focus trap y rol semántico
- [ ] Se crea un hook `useFocusTrap(ref, isOpen)` en `src/hooks/useFocusTrap.ts` que, cuando `isOpen=true`, mueve el foco al primer elemento interactivo del modal y evita que Tab salga del contenedor
- [ ] El modal de review/análisis en `DetailPanel` tiene `role="dialog" aria-modal="true" aria-labelledby="review-modal-title"`
- [ ] El modal de nuevo proyecto en `ProjectsClient` tiene los mismos atributos
- [ ] Ambos modales se cierran con la tecla Escape
- [ ] Al cerrar un modal, el foco vuelve al elemento que lo abrió

### Sidebar overlay móvil
- [ ] El overlay `<div className="sidebar-overlay">` tiene `aria-hidden="true"`
- [ ] Presionar Escape mientras el sidebar está abierto lo cierra (handler en `SidebarInner`)

### Imágenes — alt text mejorado
- [ ] `PhotoGrid.tsx`, `TimelineClient.tsx` y `TagPhotosClient.tsx` usan `alt={photo.tags?.map(t => t.name).join(', ') || photo.filename.replace(/\.[^.]+$/, '')}` en lugar de solo `photo.filename`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/globals.css` | Añadir regla `:focus-visible` global |
| `src/hooks/useFocusTrap.ts` | Nuevo hook reutilizable para focus trap en modales |
| `src/components/DetailPanel.tsx` | aria-labels en favorito, +, tag-remove, theme-item → button |
| `src/components/Sidebar.tsx` | aria-labels en edit/delete/logout, nueva-temática → button, focus-within |
| `src/app/library/LibraryClient.tsx` | aria-label + aria-expanded en hamburger |
| `src/app/timeline/TimelineClient.tsx` | aria-label + aria-expanded en hamburger |
| `src/app/stats/StatsClient.tsx` | aria-label + aria-expanded en hamburger |
| `src/app/projects/ProjectsClient.tsx` | aria-label + aria-expanded en hamburger; focus trap en modal |
| `src/app/tags/TagsClient.tsx` | aria-label + aria-expanded en hamburger |
| `src/app/tags/[tag]/TagPhotosClient.tsx` | aria-label + aria-expanded en hamburger |
| `src/components/PhotoGrid.tsx` | alt text mejorado |

---

## Notas técnicas

- El hook `useFocusTrap` debe usar `querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')` para encontrar los elementos focusables dentro del modal.
- Para el sidebar overlay, `aria-hidden="true"` ya es suficiente ya que el contenido del sidebar sí debe ser accesible.
- Los cambios de `<div>` a `<button>` en Sidebar pueden requerir resetear los estilos de botón con `background: none; border: none; cursor: pointer;`.
- La regla `:focus-visible` usa `var(--tag-auto-color)` (#3b62d4 en la paleta actual) para coherencia con el color de acento principal.

---

## Fuera de alcance (v1)

- Auditoría completa de contraste de colores (WCAG AA/AAA)
- Soporte completo de navegación por teclado en el mapa de Leaflet
- Internacionalización de los atributos ARIA
- Implementación de Live Regions para anunciar cambios dinámicos (scan progress, etc.)
