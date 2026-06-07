# US-091 — Hardening móvil web: navegación y filtros

> Estado: ✅ Desplegada

## Objetivo

Resolver los problemas de usabilidad y layout que quedaron tras la refactorización del header/filter-bar (US-017 + EPIC-005). La app web mobile debía quedar usable en iOS Safari.

---

## Problemas resueltos

### Layout

| Bug | Causa raíz | Fix |
|---|---|---|
| Franja gris entre header y nav tabs | `body { padding-top: header+nav }` pero el header es `fixed` (fuera del flujo) y la nav es `sticky` (en el flujo). La nav se desplazaba 40px más abajo de lo esperado. | `body { padding-top: var(--header-h) }` en mobile — la nav ocupa su espacio sola. |
| Sidebar cortaba los primeros items (Timeline, Todas las fotos) | Drawer arranca en `top:0` pero el header fijo (`z-index:100`) tapa los primeros 52px. | `padding-top: var(--header-h)` en `.sidebar` dentro del breakpoint 768px. |

### Filtros (iOS Safari)

| Bug | Causa raíz | Fix |
|---|---|---|
| Filtros no abrían: aparecía el backdrop oscuro pero no el sheet | `position:fixed` dentro de `position:sticky` + `overflow-x:auto` pierde el contexto de viewport en iOS Safari. | `BottomSheet` usa `createPortal(…, document.body)` para salir del subárbol del filter-bar. |
| Al tocar un filtro se veía una barra gris recortada | `isMobile` arrancaba en `false` (SSR), renderizando el dropdown `position:absolute` que quedaba clipado por `overflow-x:auto`. | `useState` con función inicializadora síncrona (`window.matchMedia`). |

### Hamburguesa faltante

Los siguientes `*Client.tsx` tenían `<Sidebar mobileOpen={...}>` pero no inyectaban el botón hamburger en el header:

- `SmartAlbumsClient` → añadido `useHeaderSlotLeft`
- `MemoriesClient` → añadido `useHeaderSlotLeft`
- `SmartAlbumDetailClient` → añadido `useHeaderSlotLeft`

### Unificación UI Álbumes / Proyectos

- Smart Albums: eliminado `<h1>` redundante; botones con `flex-wrap` para no desbordar en mobile.
- Sidebar Proyectos: eliminado botón "Nuevo proyecto" del sidebar (patrón unificado: creación en el contenido, no en el sidebar).

---

## PRs

- #142 — fix: quitar banner + mobile audit
- #143 — fix: hueco gris mobile + filtros iOS
- #144 — fix: bottom sheet filtros via portal (iOS Safari)
- #145 — fix: sidebar scroll mobile + hamburguesa Smart Albums / Recuerdos
- #146 — fix: hamburguesa mobile en SmartAlbumDetail
- #147 — fix: unificar UI álbumes / proyectos mobile
