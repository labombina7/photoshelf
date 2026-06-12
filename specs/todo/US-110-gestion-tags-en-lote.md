# Feature: Gestión de tags en lote — renombrar, fusionar y eliminar

## Historia de usuario

Como fotógrafo con miles de fotos etiquetadas (manual + IA),
quiero renombrar, fusionar y eliminar tags desde la vista de Tags,
para mantener una taxonomía limpia sin editar foto a foto.

---

## Descripción

La biblioteca acumula tags inconsistentes con el tiempo: la IA genera variantes («b&w» vs «blanco y negro»), errores tipográficos manuales («retrato» vs «retratos»), y tags que dejaron de tener sentido. Hoy la vista `/tags` es de solo lectura (nube + navegación) y la única forma de corregir un tag es abrir cada foto y editarlo.

Esta feature convierte la vista de Tags en un gestor: renombrar un tag (propagado a todas sus fotos), fusionar dos o más tags en uno (unión de fotos, sin duplicados), y eliminar un tag de toda la biblioteca. Todas las operaciones son transaccionales en SQLite y piden confirmación mostrando cuántas fotos se ven afectadas.

Es el complemento natural de US-059 (revisión de confianza de tags IA): aquella revisa asignaciones foto a foto; esta opera sobre la taxonomía global.

---

## Criterios de aceptación

### Renombrar
- [ ] Desde el chip de un tag (menú contextual o vista de detalle del tag) se puede renombrar
- [ ] Si el nuevo nombre ya existe, se ofrece fusionar en su lugar
- [ ] El renombrado conserva el `source` (manual/ai) de cada asignación

### Fusionar
- [ ] Selección múltiple de tags en la nube (modo selección) + acción «Fusionar en…»
- [ ] La fusión une las fotos de todos los tags origen en el destino sin duplicar filas en `photo_tags`
- [ ] Confirmación previa: «Fusionar 3 tags (842 fotos) en "retrato"»

### Eliminar
- [ ] Eliminar un tag lo quita de todas sus fotos, con confirmación que indica el número de fotos
- [ ] Los tags eliminados desaparecen de hints de búsqueda y stats al refrescar

### Integridad
- [ ] Cada operación corre en una transacción única
- [ ] Operaciones reflejadas en el backup JSON (sin cambios de esquema necesarios)

---

## API necesaria

- `PATCH /api/tags/manage` — `{ action: 'rename'|'merge'|'delete', source: string[], target?: string }` (o endpoints separados); auth + validación según convenciones

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/tags/TagsClient.tsx` | Modo selección + menú de acciones |
| `src/lib/queries/tags.ts` | `renameTag`, `mergeTags`, `deleteTagGlobal` transaccionales |
| `src/app/api/tags/manage/route.ts` | Nuevo endpoint |
| `src/components/ModalProvider.tsx` | (reutilizado) confirmaciones con conteo |

---

## Notas técnicas

- Fusión en SQL: `INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) SELECT photo_id, ?, source FROM photo_tags WHERE tag_id IN (…)` + `DELETE` de los orígenes + `DELETE FROM tags` huérfanos. La PK compuesta `(photo_id, tag_id)` hace el de-dupe gratis.
- `tags.name` es `UNIQUE COLLATE NOCASE` — el renombrado debe manejar el caso «mismo nombre, distinta capitalización» como rename trivial.

---

## Fuera de alcance (v1)

- Sugerencias automáticas de fusión por similitud (podría apoyarse en Ollama más adelante)
- Jerarquías o sinónimos de tags
- Deshacer (undo) — mitigado por el backup JSON
