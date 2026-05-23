# Feature: Estados vacíos con llamada a la acción directa

## Historia de usuario

Como nuevo usuario de photoshelf o como usuario cuya biblioteca está vacía,
quiero que los estados vacíos me guíen con un botón o enlace directo a la siguiente acción,
para no quedarme bloqueado sin saber qué hacer.

---

## Descripción

Tres pantallas principales muestran mensajes de estado vacío que describen el problema pero no ofrecen solución directa. En `PhotoGrid` se dice "Haz clic en «Reescanear biblioteca»" sin que haya ningún botón cerca que lo haga. En `TagsClient` se dice "Clasifica algunas fotos para empezar" sin enlace a la biblioteca. En `FolderGrid` hay solo dos palabras: "No hay carpetas."

Los estados vacíos son el momento más crítico del onboarding. Un usuario que llega por primera vez y ve una pantalla en blanco con un mensaje pasivo puede pensar que la app está rota o que no sabe cómo usarla. Añadir una acción directa convierte ese momento en una guía.

El diseño debe mantener la coherencia visual: los CTAs usan los estilos de botón existentes y el espacio del empty state ya tiene estructura CSS (`empty-state` class).

---

## Criterios de aceptación

### PhotoGrid — estado vacío principal
- [ ] Cuando no hay fotos en la biblioteca (primer uso), el mensaje principal es `"Tu biblioteca está vacía"` con subtexto `"Añade una carpeta de fotos o inicia un escaneo para comenzar."`
- [ ] Hay un botón `"Reescanear biblioteca"` que activa el scan directamente (puede usar el mismo mecanismo que el botón en Sidebar, via `fetch('/api/scan', { method: 'POST' })` o a través de un contexto/callback)
- [ ] Cuando hay fotos pero ninguna coincide con los filtros activos, el mensaje es `"No se encontraron fotos"` con subtexto `"Prueba a cambiar los filtros o la búsqueda."` y un enlace/botón `"Limpiar filtros"`

### TagsClient — estado vacío
- [ ] El mensaje es `"Aún no tienes etiquetas"` con subtexto `"Clasifica tus fotos con IA para generar etiquetas automáticas."`
- [ ] Hay un enlace `<Link href="/library">Ver biblioteca →</Link>` que lleva directamente a la biblioteca donde se puede iniciar la clasificación
- [ ] Opcionalmente (si es técnicamente simple), un botón `"Clasificar todo"` que activa una clasificación global

### FolderGrid — estado vacío
- [ ] El mensaje es `"No hay carpetas escaneadas"` con subtexto `"Verifica que la ruta de fotos esté configurada correctamente y ejecuta un escaneo."`
- [ ] Hay un botón `"Reescanear biblioteca"` con la misma acción que en PhotoGrid

### Consistencia visual
- [ ] Los tres empty states usan la clase `.empty-state` existente en globals.css
- [ ] Los botones de acción usan `btn-primary` o `btn-secondary` según corresponda
- [ ] Los mensajes principales usan la clase `.empty-state-title` y el subtexto `.empty-state-subtitle`
- [ ] En mobile el layout del empty state se mantiene legible (centrado, sin overflow)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/PhotoGrid.tsx` | Actualizar bloque empty state con título, subtexto y botón CTA |
| `src/app/tags/TagsClient.tsx` | Actualizar empty state con enlace a biblioteca |
| `src/components/FolderGrid.tsx` | Actualizar empty state con mensaje y botón de scan |
| `src/app/globals.css` | Verificar/añadir `.empty-state-title` y `.empty-state-subtitle` si no existen |

---

## Notas técnicas

- Para el botón "Reescanear biblioteca" en `PhotoGrid` y `FolderGrid`, la acción puede implementarse de dos formas: (a) invocar `fetch('/api/scan', { method: 'POST' })` directamente en el componente, o (b) exponer un callback `onScanRequest` desde `ScanProvider` via contexto. La opción (b) es más limpia arquitectónicamente.
- `PhotoGrid` ya tiene acceso a la información sobre si hay fotos o no (cuando `groups.length === 0` y no hay filtros activos vs. cuando hay filtros activos). El empty state diferenciado requiere saber si el estado vacío es por falta de datos o por filtros sin resultados.
- `FolderGrid` recibe las carpetas como prop desde la página padre; el botón de scan puede usar el mismo patrón que `ScanProvider`.

---

## Fuera de alcance (v1)

- Wizard de onboarding completo (configuración de ruta de fotos desde la UI)
- Estado vacío animado o con ilustración
- Sugerencias de carpetas basadas en el sistema de archivos
- Botón "Clasificar todo" en TagsClient (requiere análisis de coste en bibliotecas grandes)
