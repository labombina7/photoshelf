# Feature: Mejoras UX mobile — swipe sidebar, mapa bottom sheet y gestión de toasts

## Historia de usuario

Como usuario de photoshelf en un móvil o tablet,
quiero que la interfaz responda a los gestos táctiles que espero de una app nativa,
para navegar por mis fotos de forma cómoda sin tener que buscar botones pequeños o sufrir solapamientos de mensajes.

---

## Descripción

La experiencia mobile de photoshelf ha mejorado notablemente con el visor fullscreen y el bottom sheet del detalle. Quedan cuatro fricciones identificadas en la auditoría UX que afectan a la usabilidad diaria en móvil y tablet:

1. **Swipe-left para cerrar el sidebar**: el sidebar mobile se abre con el botón hamburguesa, pero solo se puede cerrar tocando el overlay o pulsando un ítem de navegación. El gesto de deslizamiento hacia la izquierda — estándar en iOS y Android — no está implementado.

2. **Panel del mapa demasiado alto en mobile**: cuando el usuario toca un marcador en el mapa, el panel de fotos asociado ocupa el 55% de la pantalla, dejando muy poco espacio de mapa visible. El patrón de BottomSheet ya existe en la app y debería aplicarse aquí.

3. **Toasts solapados en mobile**: el toast de escaneo y el toast genérico tienen las mismas coordenadas CSS en mobile (`bottom: 16px, right: 12px`). Si ambos aparecen simultáneamente, uno tapa al otro sin que el usuario pueda leer ambos.

4. **Formulario de nuevo catálogo oculto en mobile**: en la página de Catálogos con varios catálogos listados, el formulario de añadir queda al final sin indicador visual de que hay contenido debajo.

---

## Criterios de aceptación

### Swipe-left para cerrar sidebar
- [ ] Deslizar el dedo de derecha a izquierda sobre el sidebar abierto con un desplazamiento > 60px lo cierra
- [ ] La lógica usa `onTouchStart` / `onTouchEnd` en el elemento `<aside>` del sidebar
- [ ] El gesto no interfiere con el scroll vertical del contenido del sidebar
- [ ] La animación de cierre es la misma que al pulsar el overlay (slide-left con la transición CSS ya existente)

### Panel del mapa como bottom sheet
- [ ] El panel de fotos del mapa en mobile parte de una altura inicial del 40% (reducido desde 55%)
- [ ] El usuario puede arrastrar el panel hacia arriba hasta el 70% de la pantalla (drag-to-expand)
- [ ] El patrón reutiliza `BottomSheet.tsx` o la misma lógica de touch que ya usa el BottomSheet del detalle
- [ ] Al cerrar el panel, el mapa recupera el 100% del espacio visual

### Gestión de toasts simultáneos
- [ ] Si el `scan-toast` está activo, el toast genérico se desplaza a `bottom: 96px` en mobile para no solaparse
- [ ] Si solo hay un toast activo, ambos mantienen su posición habitual (`bottom: 16px`)
- [ ] El desplazamiento puede lograrse con una clase CSS condicional o una variable CSS dinámica desde `ScanProvider`

### Formulario de catálogos accesible en mobile
- [ ] En la página de Catálogos, el botón "Añadir catálogo" se mueve a la cabecera de la página (junto al título) o a un botón flotante en mobile
- [ ] Alternativamente, se mueve el formulario de creación arriba de la lista de catálogos existentes
- [ ] El usuario no necesita hacer scroll hasta el final de la lista para encontrar el control de creación

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Sidebar.tsx` | Añadir `onTouchStart`/`onTouchEnd` al `<aside>` para swipe-left |
| `src/app/map/MapClient.tsx` | Reducir altura inicial del panel a 40%, añadir drag-to-expand al 70% |
| `src/app/globals.css` | Gestión de posición de toasts simultáneos; altura del `.map-panel` en mobile |
| `src/components/ScanProvider.tsx` | Exponer estado `running` vía contexto para que `ModalProvider`/CSS pueda reaccionar |
| `src/app/settings/catalogs/CatalogsClient.tsx` | Mover CTA de añadir catálogo a la cabecera |

---

## Notas técnicas

- Para el swipe del sidebar, calcular `deltaX = touchEnd.clientX - touchStart.clientX`; si `deltaX < -60` → llamar a `closeMobile()`. El umbral de 60px es el mismo que usa el visor de fotos en US-035.
- Para el panel del mapa, el drag puede implementarse con el mismo patrón de `BottomSheet.tsx`: guardar `translateY` en state y aplicarlo vía CSS transform para evitar reflows.
- Para los toasts, la solución más sencilla es una variable CSS: `--toast-bottom: 16px` que `ScanProvider` actualiza a `96px` cuando `running === true`. Requiere pasar el estado al contexto CSS con `document.documentElement.style.setProperty`.

---

## Fuera de alcance (v1)

- Clustering del mapa en servidor para reducir marcadores en mobile
- Haptic feedback (vibración) al completar gestos táctiles
- Notificaciones push cuando el escaneo completa en background
