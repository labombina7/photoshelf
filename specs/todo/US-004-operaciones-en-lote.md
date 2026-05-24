# Feature: Operaciones en Lote

## Historia de usuario

Como fotógrafo que organiza una biblioteca con cientos de fotos por evento,
quiero seleccionar múltiples fotos a la vez y aplicarles acciones en bloque,
para etiquetar, agrupar o marcar como favorita docenas de fotos sin hacerlo una a una.

---

## Descripción

Modo de **selección múltiple** en la vista de biblioteca (`/library`) que permite al usuario activar un "modo selección", pinchar sobre las fotos que quiere incluir, y aplicar una acción en lote sobre todas ellas.

Las acciones disponibles son: añadir tag, añadir a proyecto, marcar/desmarcar favorita, y asignar tema. La selección es persistente mientras el usuario navega dentro del mismo evento (no persiste al cambiar de grupo).

El modo de selección se activa con un botón en el topbar o con un atajo de teclado (`S`). Cuando está activo, las fotos muestran un checkbox en la esquina. Se pueden seleccionar con clic individual o con `Shift+clic` para seleccionar un rango.

---

## Criterios de aceptación

### Activación del modo selección
- [ ] Botón "Seleccionar" visible en el topbar del evento cuando hay fotos cargadas
- [ ] Atajo de teclado `S` activa/desactiva el modo selección
- [ ] En modo selección el topbar muestra "N fotos seleccionadas" y el botón de acciones
- [ ] El cursor cambia sobre las fotos para indicar que son seleccionables
- [ ] Botón "Cancelar" o `Escape` desactiva el modo y limpia la selección

### Selección de fotos
- [ ] Clic sobre una foto la selecciona/deselecciona (toggle)
- [ ] `Shift+clic` selecciona el rango entre la última foto seleccionada y la clicada
- [ ] Checkbox visible en esquina superior izquierda de cada foto en modo selección
- [ ] Botón "Seleccionar todas" (del grupo visible) selecciona todas las fotos del evento activo
- [ ] La selección no persiste al salir del modo selección ni al cambiar de evento

### Acciones disponibles
- [ ] **Añadir tag**: selector con autocompletado de tags existentes + opción de crear nuevo; se aplica a todas las fotos seleccionadas (source: 'manual')
- [ ] **Marcar favorita**: toggle — si ninguna es favorita, las marca todas; si alguna ya lo es, desmarca todas
- [ ] **Añadir a proyecto**: selector con lista de proyectos existentes; añade las fotos al final del proyecto (respetando `position`)
- [ ] **Asignar tema**: selector con lista de temas con su color; asigna el tema a todas las fotos seleccionadas
- [ ] Cada acción muestra feedback inmediato (toast) con "Aplicado a N fotos"

### UX de acciones
- [ ] Las acciones aparecen en un panel flotante (bottom bar) cuando hay ≥1 foto seleccionada
- [ ] El panel muestra: número de seleccionadas + iconos de acción + botón "Cancelar"
- [ ] Las acciones son no destructivas en esta versión (no se puede borrar en lote)
- [ ] Si una acción falla parcialmente, el toast indica cuántas tuvieron éxito

### Compatibilidad con vistas existentes
- [ ] El modo selección solo existe en `/library`, no en timeline ni en proyectos
- [ ] El panel de detalle (`DetailPanel`) no se abre al hacer clic en modo selección
- [ ] Los filtros activos (año, evento, tema, tag) siguen funcionando en modo selección

---

## API necesaria

### `POST /api/photos/bulk`

Aplica una operación a múltiples fotos.

**Body:**
```json
{
  "photoIds": [1, 2, 3, 42],
  "action": "tag" | "favorite" | "unfavorite" | "project" | "theme",
  "value": "string o número según la acción"
}
```

**Respuesta:**
```json
{ "updated": 4, "skipped": 0 }
```

Las acciones concretas:
- `tag`: `value` = nombre del tag (string)
- `favorite` / `unfavorite`: `value` ignorado
- `project`: `value` = `projectId` (number como string)
- `theme`: `value` = `themeId` (number como string)

---

## Ruta y navegación

No añade rutas nuevas. Modifica la vista existente en `/library`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/library/LibraryClient.tsx` | Añadir estado de selección, modo selección, `Shift+clic` |
| `src/components/PhotoGrid.tsx` | Mostrar checkbox en modo selección; bloquear apertura de detalle |
| `src/components/BulkActionBar.tsx` | Panel flotante inferior con acciones y contador |
| `src/app/api/photos/bulk/route.ts` | Endpoint de acciones en lote |

---

## Notas técnicas

- El estado de selección vive en `LibraryClient` como `Set<number>` de photo IDs
- El modo selección se pasa como prop a `PhotoGrid` para evitar re-renders innecesarios en fotos no seleccionadas
- La operación de rango (`Shift+clic`) necesita el índice de la última foto seleccionada en el array de fotos visible
- La API `bulk` usa una transacción SQLite para aplicar cambios atómicamente
- La adición a proyecto calcula `MAX(position) + 1` dentro de la transacción para evitar colisiones
- Validación en el endpoint: máximo 500 fotos por operación para evitar queries excesivamente grandes

---

## Fuera de alcance (v1)

- Borrado masivo de fotos (demasiado destructivo para v1)
- Operaciones en lote en la vista timeline
- Selección persistente entre sesiones
- Reordenar fotos seleccionadas dentro de un proyecto
- Aplicar múltiples tags en una sola operación de lote
