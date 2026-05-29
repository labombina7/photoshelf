# US-035 — Visor de foto fullscreen en mobile

> Estado: ✅ Desplegada — commit 97280ea (directo a main, 2026-05-29)

## Problema

En la vista de detalle de foto, en móvil la imagen ocupa solo `45vh` (o `calc(100vh - 52px)` si el sheet está cerrado), con una topbar visible que consume espacio y con el panel de información abierto por defecto tapando parte de la foto.

El resultado no se parece a un visor de fotos nativo; parece una página web. En iOS Photos o Google Photos la foto ocupa **toda la pantalla** y los controles se superponen semitransparentes sobre ella.

---

## Objetivo

Transformar la vista de detalle en mobile en un **visor inmersivo fullscreen** donde:
- La foto ocupa el 100 % de la pantalla (fondo negro).
- La topbar desaparece; los controles (atrás, info, flechas de navegación) flotan semitransparentes encima de la imagen.
- El panel de información está **cerrado por defecto** y se abre solo al pulsar el botón ⓘ.
- La experiencia se parece a una app nativa de fotos.

---

## Comportamiento esperado (mobile ≤ 640 px)

### Vista inicial
```
┌─────────────────────────────┐  ← negro, 100dvh
│ ← Atrás             ⓘ Info │  ← HUD semitransparente, fondo gradient
│                             │
│                             │
│         [ FOTO ]            │  ← object-fit: contain, negro alrededor
│                             │
│                             │
│     ‹               ›       │  ← flechas prev/next en los laterales
│                             │
└─────────────────────────────┘
```
- Fondo negro `#000`.
- La foto centra verticalmente con `object-fit: contain`.
- HUD superior: gradiente negro-transparente, botón "← Atrás" a la izquierda, botón "ⓘ" a la derecha.
- HUD inferior (si hay prev/next): flechas izquierda/derecha semitransparentes en los bordes laterales del centro vertical.
- Tap en la foto → oculta/muestra el HUD (toggle inmersivo).

### Al pulsar ⓘ
```
┌─────────────────────────────┐
│ ← Atrás             ⓘ Info │
│                             │
│     [ FOTO (dimmed) ]       │
│                             │
├─────────────────────────────┤  ← bottom sheet con handle
│  ╌╌╌╌╌╌╌╌  handle           │
│                             │
│  🗓  10 julio 2023          │
│  📁  Vacaciones Roma        │
│  🏷  b&w  verano  italia    │
│  ⭐  Favorito               │
│  …  (resto del DetailPanel) │
└─────────────────────────────┘
```
- El bottom sheet se abre desde abajo con animación (igual que el buscador).
- La foto detrás se oscurece ligeramente (overlay `rgba(0,0,0,0.4)`).
- Cerrar el sheet → la foto vuelve a estar a plena visibilidad.

### Navegación
- Swipe horizontal izquierda/derecha → foto anterior/siguiente (**ya implementado**, conservar).
- Flechas laterales visibles en el HUD.
- Las flechas prev/next desaparecen si no hay foto anterior/siguiente.

### Desktop (≥ 641 px)
- Sin cambios: topbar + panel lateral visible siempre. Solo afecta mobile.

---

## Criterios de aceptación

- [ ] En mobile la foto ocupa toda la pantalla (`100dvh`, fondo negro).
- [ ] La topbar (`detail-topbar`) no se muestra en mobile; en su lugar hay un HUD flotante con gradiente.
- [ ] El HUD incluye: botón "← Atrás" (top-left), botón "ⓘ" (top-right) y flechas de navegación (laterales si existen prev/next).
- [ ] Al cargar la página, el panel de info está **cerrado** (`mobileSheetOpen = false`).
- [ ] Pulsar ⓘ abre el bottom sheet con `DetailPanel`.
- [ ] Cerrar el bottom sheet (swipe down o × si lo hay) cierra el panel; la foto queda de nuevo visible al 100 %.
- [ ] Tap en la zona de foto (fuera del HUD) alterna la visibilidad del HUD.
- [ ] El swipe horizontal para navegar sigue funcionando.
- [ ] En desktop el comportamiento actual no cambia.
- [ ] Sin errores TypeScript, sin regresiones en desktop.

---

## Alcance técnico

### Archivos a modificar

**`src/app/library/[photoId]/PhotoDetailClient.tsx`**
- Añadir estado `hudVisible: boolean` (defecto `true`).
- Cambiar `mobileSheetOpen` inicial a `false`.
- En mobile, envolver foto + HUD en un `div.photo-viewer-mobile` fullscreen.
- El HUD superior: `div.photo-viewer-hud-top` con gradiente + botones.
- Flechas laterales: `div.photo-viewer-nav-prev/next`.
- Tap en `div.photo-viewer-bg` → `setHudVisible(v => !v)`.
- Abrir sheet al pulsar ⓘ.

**`src/app/globals.css`**
- `.photo-viewer-mobile`: `position: fixed; inset: 0; z-index: 50; background: #000; display: flex; align-items: center; justify-content: center;` — solo activo en `@media (max-width: 640px)`.
- `.photo-viewer-hud-top`: `position: absolute; top: 0; left: 0; right: 0; padding: calc(env(safe-area-inset-top,0px) + 12px) 16px 40px; background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%); display: flex; justify-content: space-between; align-items: center;`.
- `.photo-viewer-hud-top button`: texto blanco, fondo none, `text-shadow: 0 1px 4px rgba(0,0,0,0.8)`.
- `.photo-viewer-nav-prev/next`: `position: absolute; top: 50%; transform: translateY(-50%); padding: 16px 12px;` con flechas blancas semitransparentes.
- `.photo-viewer-hud--hidden`: `opacity: 0; pointer-events: none; transition: opacity 0.2s`.
- `.photo-viewer-img`: `max-width: 100%; max-height: 100dvh; object-fit: contain; display: block;`.
- `.photo-viewer-mobile` oculto en desktop; el resto del layout desktop no cambia.
- La topbar (`detail-topbar`) se oculta en mobile `@media (max-width: 640px) { .detail-topbar { display: none; } }`.

### Notas de implementación

- El `BottomSheet` y el `DetailPanel` ya existen — reutilizar sin cambios.
- El overlay dimmer para la foto cuando el sheet está abierto: `div.photo-viewer-dimmer` con `position: absolute; inset: 0; background: rgba(0,0,0,0.4); pointer-events: none; transition: opacity 0.2s` (visible si `mobileSheetOpen`).
- La animación de entrada del sheet ya existe (`.mobile-sheet-up`).
- Asegurarse de que `body { overflow: hidden }` no interfiere cuando el visor está activo — usar la misma técnica de scroll lock que en el buscador si fuera necesario.

---

## Fuera de alcance

- Zoom con pinch-to-zoom sobre la imagen (puede ser una US futura).
- Modo panorámico / rotación de pantalla.
- Compartir foto.
- Gestos de swipe vertical para cerrar el visor.

---

## Métricas de éxito

- La foto ocupa el 100 % de la pantalla en mobile sin márgenes de topbar ni hueco gris.
- El tiempo hasta ver la primera foto (al abrir el detalle) no empeora — el panel de info ya no bloquea la foto al cargar.
