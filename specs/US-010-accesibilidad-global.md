# Feature: Accesibilidad global — aria-labels, focus y semántica HTML

## Historia de usuario

Como usuario de photoshelf con necesidades de accesibilidad o que navega con teclado,
quiero que todos los controles interactivos sean navegables y etiquetados correctamente,
para poder usar la aplicación sin depender exclusivamente del ratón.

---

## Descripción

Una pasada sistemática de accesibilidad sobre todos los componentes de la app. Los problemas
principales detectados en la auditoría UX son: botones icon-only sin `aria-label`, `<div>`
con `onClick` en lugar de `<button>`, imágenes sin atributo `alt`, y ausencia de estilos
`:focus-visible` en muchos controles interactivos.

Esta US no requiere rediseño visual — son cambios HTML/CSS puntuales con alto impacto
en accesibilidad y también en la percepción de calidad del producto.

---

## Criterios de aceptación

### Botones icon-only
- [ ] Todos los botones que muestran sólo un icono (cerrar panel, zoom +/-, favorito, menú…)
  tienen `aria-label` descriptivo o `title` visible en tooltip
- [ ] El Sidebar tiene `role="navigation"` y `aria-label="Navegación principal"`

### Semántica HTML
- [ ] Ningún `<div onClick>` o `<span onClick>` actúa como botón interactivo — reemplazados por `<button>`
- [ ] Las celdas de foto en el grid que son clickables usan `<button>` o `<a>` según corresponda
- [ ] Los controles de zoom visual son `<button>` con `aria-pressed` o `aria-label` apropiado

### Imágenes
- [ ] Todos los `<img>` de thumbnails tienen `alt={photo.filename}` (ya implementado en muchos) o `alt=""` si son decorativos
- [ ] El avatar/icono del sidebar tiene `alt` adecuado

### Focus visible
- [ ] Se añade una regla CSS global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` que aplica a todos los elementos interactivos
- [ ] Los estilos `outline: none` que ocultan el foco sin reemplazarlo se eliminan o condicionan a `not(:focus-visible)`

### Navegación por teclado
- [ ] La barra lateral (Sidebar) es navegable con Tab en orden lógico
- [ ] El DetailPanel puede cerrarse con la tecla Escape
- [ ] El modal de búsqueda puede cerrarse con Escape y el foco vuelve al trigger

---

## Componentes nuevos o modificados

| Componente | Cambio |
|---|---|
| `src/app/globals.css` | Añadir regla `:focus-visible` global |
| `src/components/Sidebar.tsx` | `role="navigation"`, `aria-label`, botones con `aria-label` |
| `src/components/DetailPanel.tsx` | Escape para cerrar, botones icon-only etiquetados |
| `src/components/PhotoGrid.tsx` | Celdas como `<button>` o `<a>`, `alt` en thumbnails |
| `src/components/ZoomControls.tsx` | Botones con `aria-label` y `aria-pressed` |

---

## Notas técnicas

- Usar `eslint-plugin-jsx-a11y` para detectar violaciones automáticamente en CI
- Los cambios son retrocompatibles — no alteran estilos visuales a menos que el usuario use teclado
- Esfuerzo estimado: < 1 día (pasada mecánica + revisión)

---

## Fuera de alcance (v1)

- ARIA live regions para actualizaciones dinámicas (scan progress, toast)
- Soporte de lectores de pantalla (NVDA, VoiceOver) — requiere testing especializado
- Skip-to-content link
- Contraste de color en modo oscuro (auditar por separado)
