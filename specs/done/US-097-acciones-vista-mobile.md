# Feature: Acciones de vista accesibles en mobile

## Historia de usuario

Como usuario que navega su biblioteca desde el móvil,
quiero poder lanzar la presentación, cambiar entre vista lista/carpetas y activar el modo selección,
para tener las mismas capacidades que en desktop sin depender de gestos ocultos.

---

## Descripción

El UX audit del 2026-06-12 detectó que en pantallas ≤640px la regla `.filter-bar-actions { display: none }` (`globals.css:624`) elimina las tres acciones de vista de la FilterBar: el botón de presentación, el toggle lista/carpetas y el botón de selección para compartir. El modo selección sigue existiendo vía long-press (500 ms sobre una foto), pero no hay ninguna pista visual de que exista.

Además, dos elementos flotantes colisionan: el FAB de búsqueda (esquina inferior derecha) queda encima de la barra de acciones de selección (`selection-action-bar`) cuando el modo selección está activo.

Por último, el doble-tap del timeline para alternar Mes/Día escucha en todo el contenedor (`TimelineClient.tsx:259-272`): dos taps rápidos sobre una miniatura cambian el zoom **y** navegan al detalle a la vez.

---

## Criterios de aceptación

### Acciones de vista en mobile
- [ ] En ≤640px existe un punto de entrada visible para: presentación, toggle lista/carpetas y modo selección (menú «···» en el header slot o sección en el bottom sheet de filtros)
- [ ] La presentación se puede lanzar desde la biblioteca en móvil
- [ ] El long-press sigue funcionando como atajo del modo selección

### Descubribilidad del long-press
- [ ] La primera vez que el usuario entra en vista lista en móvil se muestra un hint efímero («Mantén pulsada una foto para seleccionar»), persistido en localStorage para no repetirse

### Colisiones de elementos flotantes
- [ ] El FAB de búsqueda se oculta mientras `selectionMode` está activo (igual que se oculta con el sheet abierto)

### Doble-tap del timeline
- [ ] El doble-tap que alterna Mes/Día se ignora cuando el target está dentro de un `.photo-item`
- [ ] Doble tap sobre una foto solo navega (sin cambio de zoom simultáneo)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/FilterBar.tsx` | Exponer acciones en mobile (menú o sheet) |
| `src/app/globals.css` | Sustituir el `display: none` por el nuevo layout |
| `src/components/AppHeader.tsx` | Ocultar FAB con `selectionMode` (vía evento o contexto) |
| `src/app/library/LibraryClient.tsx` | Hint de long-press + estado compartido del FAB |
| `src/app/timeline/TimelineClient.tsx` | `e.target.closest('.photo-item')` en el handler de doble-tap |

---

## Notas técnicas

- El bottom sheet de filtros (`FilterBar` → `BottomSheet`) ya existe — añadir una sección «Vista» es el camino de menor fricción.
- Para ocultar el FAB desde LibraryClient se puede reutilizar el patrón de eventos `photoshelf:*` ya usado por el sidebar (`photoshelf:sidebar-open`).

---

## Fuera de alcance (v1)

- Reordenar o personalizar las acciones de la FilterBar
- Selección por arrastre multi-foto

> Estado: ✅ Desplegada
