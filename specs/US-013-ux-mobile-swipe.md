# Feature: UX mobile — swipe gestures y bottom sheet

## Historia de usuario

Como fotógrafo que usa photoshelf desde el móvil (mientras Ollama y la app iOS no están disponibles),
quiero una experiencia táctil fluida con gestos naturales de swipe,
para navegar por mis fotos y ver detalles de forma cómoda desde el teléfono.

---

## Descripción

La web de photoshelf es la alternativa principal a la futura app iOS. Actualmente la experiencia
mobile tiene varias fricciones: el DetailPanel lateral no es natural en móvil (debería ser un
bottom sheet), no hay swipe entre fotos en el panel de detalle, y algunos controles son demasiado
pequeños para el dedo.

Esta US adapta los componentes más usados en móvil para que se comporten de forma nativa-like:
swipe horizontal para navegar entre fotos, bottom sheet en lugar de panel lateral, y targets táctiles
mínimos de 44px.

---

## Criterios de aceptación

### Bottom sheet en móvil (DetailPanel)
- [ ] En viewports ≤ 768px, el DetailPanel se renderiza como bottom sheet (deslizable desde abajo)
  en lugar del panel lateral actual
- [ ] El bottom sheet tiene un handle visible arriba para indicar que es arrastrable
- [ ] Arrastrar hacia abajo el bottom sheet lo cierra (con animación de slide-down)
- [ ] El backdrop semitransparente detrás del sheet cierra el panel al pulsarlo

### Swipe para navegar entre fotos
- [ ] En el DetailPanel (o bottom sheet en móvil), se puede hacer swipe horizontal para pasar
  a la foto anterior / siguiente
- [ ] Hay indicadores visuales de que hay fotos a ambos lados (chevron translúcido en los bordes)
- [ ] La animación de swipe es fluida (60fps con CSS transform, sin redibujado de layout)
- [ ] En desktop, las flechas de teclado ← → siguen funcionando para navegar entre fotos

### Targets táctiles
- [ ] Todos los botones de la interfaz tienen un área táctil mínima de 44×44px
- [ ] El zoom control (+/-) tiene separación suficiente entre botones en móvil para evitar pulsaciones erróneas
- [ ] El botón de cerrar el DetailPanel es fácilmente alcanzable con el pulgar (esquina inferior o superior)

### Sidebar en móvil
- [ ] En móvil, el sidebar se oculta por defecto y se abre con un botón hamburguesa
- [ ] El sidebar abierto tiene backdrop semitransparente y se cierra pulsando fuera o con Escape

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/DetailPanel.tsx` | Adaptar a bottom sheet en móvil |
| `src/components/BottomSheet.tsx` | Nuevo — wrapper de bottom sheet con gestos |
| `src/components/Sidebar.tsx` | Comportamiento hamburguesa en móvil |
| `src/app/globals.css` | Media queries y transiciones para mobile |

---

## Notas técnicas

- Para el swipe usar `touch-action: pan-y` en el contenedor de fotos y `onTouchStart`/`onTouchEnd`
  para detectar el gesto horizontal sin conflicto con el scroll vertical
- Threshold recomendado: desplazamiento > 50px con velocidad > 0.3 px/ms = cambio de foto
- La detección de móvil puede hacerse con CSS media queries (`max-width: 768px`) — no usar JS user-agent
- La animación del bottom sheet usar `transform: translateY` con `transition: transform 300ms ease-out`

---

## Fuera de alcance (v1)

- Pinch-to-zoom sobre la foto en el DetailPanel
- Gestos de larga presión (long press) para selección múltiple
- PWA (añadir a la pantalla de inicio) — ver US-019
- Modo landscape específico en móvil
