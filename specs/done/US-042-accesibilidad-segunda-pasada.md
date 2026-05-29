# Feature: Accesibilidad — segunda pasada de aria-labels, roles y alt dinámico

> Estado: ✅ Desplegada — PR #77 mergeado el 2026-05-30

## Historia de usuario

Como usuario de photoshelf que usa lector de pantalla o navega con teclado,
quiero que todos los controles interactivos tengan etiquetas descriptivas y que las imágenes tengan texto alternativo útil,
para poder acceder al contenido de mis fotos y controlar la app sin depender de la visión.

---

## Descripción

La US-010 (Accesibilidad global) fue desplegada y resolvió los problemas más visibles de aria-labels en botones icon-only, roles HTML y navegación por teclado. La auditoría UX del 2026-05-29 identificó un segundo grupo de problemas de accesibilidad que no estaban cubiertos por esa primera pasada:

1. **Botones de editar/eliminar temática en el sidebar** (`IconEdit` e `IconTrash`): tienen `title` pero no `aria-label`. En lectores de pantalla, `title` no siempre se anuncia como accessible name cuando el botón carece de texto visible.
2. **Botón de cierre del modal de review de foto** (clase `ai-panel-close`): la clase no está definida en `globals.css`, por lo que el botón puede ser difícil de ver o pulsar y no tiene `aria-label`.
3. **Alt text dinámico en thumbnails**: `PhotoGrid.tsx` y `TimelineClient.tsx` usan `alt={photo.filename}` — un nombre técnico como `IMG_20230815.jpg` no describe el contenido. Si la foto tiene tags de IA, esos deberían ser el alt text.
4. **Slider de número de fotos en proyectos** (`input[type="range"]`): no tiene `aria-label` ni `aria-valuetext`, por lo que un lector de pantalla anuncia solo el valor numérico sin contexto.
5. **Tabs de año en la biblioteca**: los botones de año actúan como tabs pero son `<button>` simples sin `role="tab"` ni `aria-selected`.

---

## Criterios de aceptación

### Botones de temática en sidebar
- [ ] El botón "Editar temática" en `Sidebar.tsx` tiene `aria-label="Editar temática {theme.name}"`
- [ ] El botón "Eliminar temática" tiene `aria-label="Eliminar temática {theme.name}"`
- [ ] Se mantiene el `title` existente para usuarios con ratón (tooltip en hover)

### Botón de cierre del modal de review
- [ ] Se añaden estilos para `.ai-panel-close` en `globals.css` (similar a `.lightbox-close`: posición, tamaño mínimo, cursor)
- [ ] El botón tiene `aria-label="Cerrar análisis de IA"`
- [ ] El área táctil mínima es de 44×44px

### Alt text dinámico en thumbnails
- [ ] Si la foto tiene tags, `alt` se construye con los primeros 3 tags: `tag1, tag2, tag3`
- [ ] Si la foto no tiene tags, el `alt` mantiene el `photo.filename` como fallback
- [ ] El cambio aplica tanto en `PhotoGrid.tsx` como en `TimelineClient.tsx`
- [ ] La API de fotos incluye los primeros 3 tags en la respuesta paginada para evitar queries adicionales

### Slider de proyectos
- [ ] `<input type="range">` en `ProjectsClient.tsx` tiene `aria-label="Número de fotos"`
- [ ] Tiene `aria-valuetext={`${count} fotos`}` que se actualiza dinámicamente con el valor del slider

### Tabs de año en biblioteca
- [ ] El contenedor de botones de año tiene `role="tablist"` y `aria-label="Filtrar por año"`
- [ ] Cada botón de año tiene `role="tab"` y `aria-selected={activeYear === String(y)}`
- [ ] El tab activo tiene `tabindex="0"` y los inactivos `tabindex="-1"` (patrón ARIA tablist)

---

## API necesaria

La API de fotos (paginada) debería devolver los primeros N tags por foto para el alt text dinámico. Si la respuesta ya incluye tags completos, esta sección no requiere cambios de API. Verificar en `src/lib/queries/photos.ts`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Sidebar.tsx` | `aria-label` dinámico en botones de editar/eliminar temática |
| `src/components/DetailPanel.tsx` | `aria-label` en botón `ai-panel-close` |
| `src/app/globals.css` | Estilos para `.ai-panel-close` |
| `src/components/PhotoGrid.tsx` | Alt dinámico con tags; actualizar tipo de `photo` si es necesario |
| `src/app/timeline/TimelineClient.tsx` | Alt dinámico con tags |
| `src/app/projects/ProjectsClient.tsx` | `aria-label` y `aria-valuetext` en el slider |
| `src/app/library/LibraryClient.tsx` | `role="tablist"` / `role="tab"` / `aria-selected` en los botones de año |

---

## Notas técnicas

- Para los alt dinámicos, verificar si la respuesta de `GET /api/photos` ya incluye tags. Si no, añadir los 3 primeros tags (por frecuencia o posición) a la query de listado usando `GROUP_CONCAT` limitado.
- El patrón ARIA tablist requiere gestión de foco con teclado (flechas ← → entre tabs). Si esto añade demasiada complejidad, es aceptable usar solo `role="tab"` y `aria-selected` sin la navegación por teclado entre tabs en v1.
- Los cambios son retrocompatibles y no afectan el comportamiento visual existente.

---

## Fuera de alcance (v1)

- ARIA live regions para actualizaciones de escaneo y clasificación (cubrir en US de scanning UX)
- Contraste de color en modo oscuro
- Testing con VoiceOver / NVDA / JAWS
- Skip-to-content link global
