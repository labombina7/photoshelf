# Feature: Modo presentación — slideshow automático con intervalo configurable

## Historia de usuario

Como fotógrafo que quiere mostrar sus fotos en una pantalla o TV conectada al NAS,
quiero poder activar un modo de presentación automático que cicle entre las fotos del evento o album seleccionado,
para disfrutar de mis fotos sin interacción continua, como un marco digital moderno.

---

## Descripción

photoshelf corre en un NAS casero al que los usuarios acceden desde el televisor o desde cualquier pantalla grande del hogar. Un caso de uso natural y diferenciador es el de "marco digital": activar un slideshow que muestre las fotos de las vacaciones de verano mientras se cena, o mostrar las mejores fotos del año en la pantalla del salón.

El modo presentación es una extensión del visor fullscreen (US-035 y US-036) que añade avance automático configurable, transiciones suaves entre fotos y un HUD mínimo con controles de play/pausa.

---

## Criterios de aceptación

### Activar el modo presentación
- [ ] En la vista de biblioteca (filtrada por evento o año), existe un botón "Presentación" en la toolbar
- [ ] En el visor fullscreen de foto (US-035/US-036), existe un botón "▶ Presentación" en el HUD
- [ ] Al activarlo, la presentación comienza desde la foto actual y avanza por el conjunto filtrado activo
- [ ] La tecla `P` activa/desactiva el modo presentación cuando el foco no está en un input

### Comportamiento del slideshow
- [ ] Las fotos avanzan automáticamente cada N segundos (por defecto: 5s)
- [ ] El intervalo es configurable desde el HUD: 3s / 5s / 10s / 30s
- [ ] Al llegar a la última foto, el ciclo vuelve a la primera (loop continuo)
- [ ] La presentación puede pausarse y reanudarse con `Espacio` o con el botón de play/pausa del HUD

### HUD de presentación
- [ ] El HUD es mínimo: solo visible al mover el ratón o al tocar la pantalla; se oculta después de 3 segundos de inactividad
- [ ] Controles visibles: play/pausa, anterior, siguiente, configuración de intervalo, salir de presentación
- [ ] Una barra de progreso fina en la parte inferior muestra el tiempo restante antes del avance automático
- [ ] El contador de posición ("7 / 47") es visible en el HUD

### Transiciones
- [ ] Las fotos cambian con una transición de crossfade (fade-out + fade-in) de 0.5s
- [ ] Las transiciones son suaves y no causan layout shift ni parpadeo

### Sin regresiones
- [ ] Salir del modo presentación con `Escape` o con el botón de salida devuelve al estado exacto anterior (misma foto, mismos filtros)
- [ ] El modo funciona correctamente en tablets y en pantallas de TV (viewport grande)

---

## API necesaria

No requiere endpoints nuevos. El conjunto de fotos se obtiene reutilizando la paginación existente, precargando en background mientras la presentación avanza.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Slideshow.tsx` | Nuevo — lógica de avance automático, HUD, intervalo, transiciones |
| `src/app/library/[photoId]/PhotoDetailClient.tsx` | Botón de activar presentación en el HUD del visor |
| `src/app/library/LibraryClient.tsx` | Botón "Presentación" en la toolbar de biblioteca |
| `src/app/globals.css` | Estilos de crossfade, barra de progreso y HUD de presentación |

---

## Notas técnicas

- La transición de crossfade usa `opacity` y `position: absolute` para superponer las dos fotos durante el cambio — evitar `transition` en `src` del `<img>` (no funciona bien)
- El precargado de la siguiente foto puede hacerse con `new Image()` en JavaScript antes de que el timer expire
- El intervalo usa `setInterval` con cleanup en `useEffect` (no `setTimeout` encadenado) para mayor precisión
- La barra de progreso puede ser un `<div>` con `width: X%` actualizado cada 100ms, o mejor, una animación CSS con `animation-duration` ajustable

---

## Fuera de alcance (v1)

- Música de fondo sincronizada con la presentación
- Transiciones más elaboradas (ken-burns effect, slide)
- Modo kiosk con pantalla completa del sistema operativo (requiere API de Fullscreen del navegador + prompts de permiso)
- Configuración de presentación guardada por usuario en la BD
