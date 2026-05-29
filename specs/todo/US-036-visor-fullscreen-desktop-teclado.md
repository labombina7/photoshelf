# US-036 — Visor fullscreen en desktop con navegación por teclado

## Problema

En la vista de detalle de foto en desktop, no existe forma de ver la imagen ocupando toda la pantalla. El usuario tiene la foto rodeada de topbar, panel lateral e información, lo que impide una visualización inmersiva cuando quiere centrarse en la imagen.

Además, no hay navegación por teclado entre fotos — el único modo de ir a la siguiente es hacer clic en los botones de la topbar.

---

## Objetivo

Añadir un **modo visor fullscreen** que:
- Se activa desde el detalle de foto (botón visible en la imagen o atajo de teclado).
- Muestra la foto ocupando el 100 % de la pantalla con fondo negro.
- Permite navegar entre fotos con las **flechas del teclado** (← →) y con **iconos flotantes** de prev/next.
- Ofrece un **botón flotante X** para cerrar el visor y volver al detalle.

---

## Comportamiento esperado

### Activar el modo fullscreen

- Botón de pantalla completa (⛶ o ▢) visible en la zona de la imagen en el detalle de foto.
- Al pulsarlo, se abre el visor fullscreen.
- También se puede activar pulsando la tecla `F` mientras el foco no está en un input.

### Vista fullscreen

```
┌──────────────────────────────────────────┐  ← negro, 100dvh × 100vw
│                                     [X]  │  ← botón cerrar, top-right
│                                          │
│                                          │
│  [‹]        [ FOTO ]               [›]  │  ← flechas flotantes, centradas verticalmente
│                                          │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

- Fondo negro `#000`.
- La foto centra con `object-fit: contain`.
- Botón **×** (cerrar) en la esquina superior derecha — flotante, semitransparente.
- Flecha **‹** (anterior) en el borde izquierdo, centrada verticalmente — solo si existe foto previa.
- Flecha **›** (siguiente) en el borde derecho, centrada verticalmente — solo si existe foto siguiente.
- Los botones flotantes tienen fondo `rgba(0,0,0,0.4)` y se vuelven opacos al hover.
- Escape → cierra el visor.

### Navegación

| Acción | Resultado |
|---|---|
| Tecla `←` | Foto anterior (si existe) |
| Tecla `→` | Foto siguiente (si existe) |
| Click flecha ‹ | Foto anterior |
| Click flecha › | Foto siguiente |
| Tecla `Escape` | Cerrar el visor |
| Click botón `×` | Cerrar el visor |

- Al navegar, la URL se actualiza a la del nuevo photoId (misma lógica que las flechas actuales).
- Si no hay foto anterior, la flecha ‹ no se renderiza. Ídem para ›.
- El foco queda capturado dentro del visor mientras está activo (no se puede Tab fuera).

### Mobile (≤ 640 px)

- El modo fullscreen ya está cubierto por US-035 (visor inmersivo siempre activo).
- Este visor adicional **no se activa en mobile** — el botón de fullscreen no se muestra.
- La navegación por teclado tampoco aplica en mobile.

---

## Criterios de aceptación

- [ ] Existe un botón visible en el detalle de foto (desktop) para entrar en modo fullscreen.
- [ ] Al pulsarlo, la foto ocupa el 100 % de la pantalla con fondo negro.
- [ ] Hay un botón × flotante (top-right) que cierra el visor.
- [ ] Hay flechas flotantes ‹ y › que navegan entre fotos (si existen prev/next).
- [ ] La tecla `←` navega a la foto anterior (si existe).
- [ ] La tecla `→` navega a la foto siguiente (si existe).
- [ ] La tecla `Escape` cierra el visor.
- [ ] La tecla `F` (fuera de inputs) activa el visor.
- [ ] Las flechas y el X tienen un hover state visible.
- [ ] El botón de fullscreen no aparece en mobile (≤ 640 px).
- [ ] Sin errores TypeScript, sin regresiones en mobile ni en desktop.

---

## Alcance técnico

### Archivos a modificar

**`src/app/library/[photoId]/PhotoDetailClient.tsx`**
- Añadir estado `fullscreenOpen: boolean` (defecto `false`).
- `useEffect` con listeners de teclado:
  - `ArrowLeft` → navegar a `prevId` si existe.
  - `ArrowRight` → navegar a `nextId` si existe.
  - `Escape` → cerrar visor (`setFullscreenOpen(false)`).
  - `f` / `F` (si `!fullscreenOpen` y el foco no está en input/textarea) → abrir visor.
- Renderizar el overlay fullscreen condicionalmente: `div.photo-fs-overlay`.
- Botón × (`.photo-fs-close`), flechas ‹ / › (`.photo-fs-nav-prev`, `.photo-fs-nav-next`).
- Botón de activación (`.photo-fs-trigger`) en la zona de imagen, solo visible en desktop.

**`src/app/globals.css`**
- `.photo-fs-overlay`: `position: fixed; inset: 0; z-index: 100; background: #000; display: flex; align-items: center; justify-content: center;` — siempre disponible, hidden en mobile con `@media (max-width: 640px) { display: none; }`.
- `.photo-fs-img`: `max-width: 100vw; max-height: 100dvh; object-fit: contain; display: block;`.
- `.photo-fs-close`, `.photo-fs-nav-prev`, `.photo-fs-nav-next`: `position: absolute; background: rgba(0,0,0,0.4); color: #fff; border: none; cursor: pointer; border-radius: 50%; padding: 10px; transition: background 0.15s;` — hover: `background: rgba(0,0,0,0.75)`.
- `.photo-fs-close`: `top: 16px; right: 16px; font-size: 1.4rem;`.
- `.photo-fs-nav-prev`: `left: 16px; top: 50%; transform: translateY(-50%); font-size: 1.6rem; padding: 12px 14px;`.
- `.photo-fs-nav-next`: `right: 16px; top: 50%; transform: translateY(-50%); font-size: 1.6rem; padding: 12px 14px;`.
- `.photo-fs-trigger`: botón pequeño superpuesto sobre la imagen (bottom-right), solo visible en desktop (`@media (max-width: 640px) { display: none; }`).

### Notas de implementación

- El `useEffect` con los listeners de teclado debe limpiar los listeners al desmontar y al cambiar `fullscreenOpen`.
- Cuando el visor está abierto, bloquear scroll del body con `document.body.style.overflow = 'hidden'`; restaurarlo al cerrar.
- La navegación usa el mismo router que los botones de prev/next existentes — `router.push(...)`.
- Asegurarse de que las teclas `←` y `→` **solo** funcionan cuando el foco no está en un input, textarea o elemento editable (`event.target.tagName` check).

---

## Fuera de alcance

- Zoom con pinch-to-zoom o rueda del ratón.
- Presentación de diapositivas automática (slideshow).
- Pantalla completa nativa del navegador (`requestFullscreen` API) — se usa un overlay CSS en su lugar.
- Soporte en mobile (cubierto por US-035).

---

## Métricas de éxito

- El usuario puede navegar por todas sus fotos sin salir del visor usando solo el teclado.
- El visor se abre y cierra en < 100 ms (sin peticiones de red adicionales — la imagen ya está cargada).
