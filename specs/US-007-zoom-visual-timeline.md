# Feature: Zoom Visual en la Línea de Tiempo

## Historia de usuario

Como fotógrafo que navega su biblioteca en la línea de tiempo,
quiero controlar el tamaño de las miniaturas con un zoom visual independiente del zoom temporal,
para ver pocas fotos grandes cuando quiero revisar detalles, o muchas fotos pequeñas cuando quiero explorar rápidamente un período.

---

## Descripción

La vista Timeline (`/timeline`) ya tiene un **zoom temporal** que cambia la granularidad de agrupación (año / mes / día). Esta feature añade un segundo eje independiente: el **zoom visual**, que controla cuántas columnas tiene el grid y el tamaño de cada miniatura.

El zoom visual se mueve en **5 niveles** discretos. Al hacer zoom in las fotos crecen y caben menos por fila; al hacer zoom out las fotos se reducen y caben más, permitiendo una visión panorámica de cientos de fotos a la vez. El nivel de zoom visual persiste entre sesiones (junto al temporal en `sessionStorage`).

El zoom visual es independiente del temporal: se pueden combinar libremente. Por ejemplo, "nivel día + zoom XS" muestra muchas fotos pequeñas día a día; "nivel año + zoom XL" muestra pocas fotos grandes en una vista anual.

---

## Criterios de aceptación

### Niveles de zoom visual

| Nivel | Nombre | Columnas desktop | Columnas mobile | Tamaño miniatura |
|-------|--------|-----------------|-----------------|-----------------|
| 1     | XS     | 10              | 6               | 100 px          |
| 2     | S      | 7               | 4               | 150 px          |
| 3     | M      | 5               | 3               | 200 px (default)|
| 4     | L      | 3               | 2               | 300 px          |
| 5     | XL     | 2               | 1               | 420 px          |

- [ ] El nivel por defecto al entrar por primera vez es **M (nivel 3)**
- [ ] Las columnas se implementan con CSS `grid-template-columns: repeat(N, 1fr)` — las celdas son siempre cuadradas con `aspect-ratio: 1`
- [ ] El tamaño de miniatura determina el parámetro `?size=` enviado a `/api/photos/[id]/thumbnail`
- [ ] Las transiciones entre niveles animan suavemente con `transition: grid-template-columns 200ms ease`

### Controles de zoom visual

- [ ] Dos botones en el topbar: `⊕` (zoom in) y `⊖` (zoom out), junto a los controles de zoom temporal existentes
- [ ] Los botones se deshabilitan en los extremos (XS desactiva zoom out; XL desactiva zoom in)
- [ ] Gesto de teclado: `+` / `-` (sin modificador) cambia el zoom visual
- [ ] Gesto de ratón: la rueda del ratón **sin modificador** cambia el zoom visual (cuando el cursor está sobre el grid, no sobre el sidebar)
- [ ] `Ctrl` + rueda del ratón sigue reservado para el **zoom temporal** (como define US-001)
- [ ] En mobile: gesto de pellizco (pinch-to-zoom) cambia el nivel visual entre XS ↔ XL

### Comportamiento al cambiar de nivel

- [ ] Al reducir zoom (zoom out), la vista mantiene el scroll relativo al período visible: el grupo en el centro de la pantalla sigue visible tras el cambio
- [ ] Las imágenes que ya estaban cargadas al nivel anterior se reemplazaban por las del nuevo tamaño sin parpadeo (fade suave de 150 ms)
- [ ] El navegador solicita la miniatura del nuevo tamaño solo cuando la imagen entra en el viewport (lazy loading respetado)
- [ ] Al hacer zoom out, el número de fotos por bloque de paginación se incrementa proporcionalmente (nivel XS carga 120 fotos por bloque; XL carga 20)

### Persistencia

- [ ] El nivel visual se guarda en `sessionStorage` con la clave `timeline_zoom_visual`
- [ ] Al volver desde la vista de detalle de una foto, el nivel se restaura exactamente igual
- [ ] El nivel temporal y el visual se guardan y restauran de forma independiente

### Indicador visual del nivel

- [ ] El topbar muestra un indicador discreto del nivel actual (ej. cinco puntos, el activo resaltado)
- [ ] Al pasar el cursor sobre el indicador, un tooltip muestra el nombre del nivel y el número de columnas

### Performance

- [ ] En niveles XS y S se piden miniaturas de `size=120`; en M, `size=200`; en L, `size=320`; en XL, `size=440`
- [ ] Las miniaturas de distinto tamaño se sirven desde el mismo endpoint `/api/photos/[id]/thumbnail?size=N`; el backend genera y cachea cada resolución por separado (comportamiento ya existente)
- [ ] No se recarga la página al cambiar de nivel visual; es un cambio puramente de CSS + atributos `src` de las imágenes en viewport

---

## API necesaria

No requiere cambios en el backend. El parámetro `?size=` de `/api/photos/[id]/thumbnail` ya acepta valores arbitrarios y cachea por resolución.

El endpoint `/api/timeline` no necesita modificarse; el zoom visual solo afecta cuántas fotos se muestran por bloque (parámetro `limit` existente).

---

## Ruta y navegación

No añade rutas nuevas. Modifica exclusivamente `src/app/timeline/`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/timeline/TimelineClient.tsx` | Añadir estado `visualZoom`, controles, lógica de columnas, wheel listener |
| `src/app/timeline/ZoomVisualControls.tsx` | Botones `⊕`/`⊖` e indicador de nivel (extrae lógica del topbar) |
| `src/app/timeline/useVisualZoom.ts` | Hook: estado, persistencia en sessionStorage, cálculo de columnas y tamaño |

---

## Notas técnicas

- El número de columnas se aplica con una variable CSS custom property: `--timeline-cols: 5` en el contenedor del grid, y `grid-template-columns: repeat(var(--timeline-cols), 1fr)` en el CSS. Cambiar la variable activa la transición CSS automáticamente sin re-render completo de React.
- El wheel listener se añade con `{ passive: true }` en el contenedor del grid para no bloquear el scroll. Se detecta si `event.ctrlKey` para separar zoom temporal de visual.
- En mobile, el pinch-to-zoom se implementa con `pointermove` y dos puntos de contacto calculando la variación de distancia — al superar un umbral de 40 px se avanza un nivel.
- El `limit` de paginación se calcula como `columns * rows_target` donde `rows_target = 12` (12 filas de fotos por bloque en todos los niveles).
- Al cambiar el `size` de las imágenes ya renderizadas, se actualiza el atributo `src` solo de las visibles (IntersectionObserver ya en uso para el scroll infinito). Las que están fuera del viewport simplemente reciben el nuevo `src` cuando entren.

---

## Fuera de alcance (v1)

- Zoom visual continuo (slider libre) — los 5 niveles discretos son suficientes y más predecibles
- Zoom visual en la vista biblioteca (`/library`) — solo afecta a `/timeline`
- Recordar el zoom visual en `localStorage` entre sesiones distintas (solo `sessionStorage` en v1)
- Grid masonry (alturas variables según proporción de la foto)
