# Feature: Centralización de lógica duplicada — queries, tags y configuración

## Historia de usuario

Como desarrollador de photoshelf,
quiero que la lógica de construcción de queries, inserción de tags y configuración estén en un único lugar,
para que cualquier cambio al esquema o al comportamiento solo requiera editar un archivo.

---

## Descripción

El audit de deuda técnica identificó cuatro casos de lógica duplicada que tienen impacto real en la mantenibilidad:

1. **`insertTag` transaction** está copiada en 5 archivos distintos. Si hay que añadir un campo a `photo_tags` o cambiar el comportamiento en conflictos, hay que editar los 5.
2. **`buildPhotoQuery` dinámica** está replicada con ligeras variaciones en 4+ rutas. Cada copia tiene sus propias sutiles diferencias en el orden de parámetros.
3. **`PHOTOS_PATH`** se redefine en 7 archivos con `process.env.PHOTOS_PATH ?? '/photos'`. Si el default cambia, hay 7 sitios que actualizar.
4. **`getPeriodKey` y `formatLabel`** están implementadas en el server route de timeline y en el client component, con la misma lógica duplicada.

Esta US es una refactorización pura: no cambia el comportamiento visible, solo extrae y centraliza código. El resultado es una base de código más fácil de mantener y menos propensa a bugs de divergencia entre copias.

---

## Criterios de aceptación

### `upsertPhotoTags` en db.ts
- [ ] Se crea la función `upsertPhotoTags(db: Database, photoId: number, tags: { name: string; source: 'ai' | 'manual' }[]): void` en `src/lib/db.ts`
- [ ] La función encapsula la transacción: `INSERT OR IGNORE INTO tags`, `SELECT id`, `INSERT OR IGNORE INTO photo_tags`
- [ ] Los 5 archivos que tenían la lógica inline la reemplazan por una llamada a `upsertPhotoTags`:
  - `src/app/api/ai/classify/[photoId]/route.ts`
  - `src/app/api/ai/classify/batch/route.ts`
  - `src/app/api/ai/classify/year/route.ts`
  - `src/lib/folderWatcher.ts`
  - `src/app/api/ai/search/route.ts`
- [ ] El comportamiento es idéntico al original (mismo resultado en DB)

### `buildPhotoQuery` en db.ts
- [ ] Se crea la función `buildPhotoQuery(filters: PhotoFilters): { sql: string; params: (string | number)[] }` en `src/lib/db.ts`
- [ ] El tipo `PhotoFilters` incluye: `event?: string`, `year?: number`, `theme?: number`, `favorite?: boolean`, `tag?: string`, `q?: string` (búsqueda textual)
- [ ] Las 4+ rutas que construyen queries dinámicas la reemplazan:
  - `src/app/api/photos/route.ts`
  - `src/app/api/photos/groups/route.ts`
  - `src/app/library/page.tsx`
  - `src/app/api/ai/search/route.ts` (en la parte de filtros)
- [ ] Los resultados de las queries son equivalentes a los actuales (tests de regresión)

### `PHOTOS_PATH` exportado desde config.ts
- [ ] Se crea (o amplía) `src/lib/config.ts` exportando `export const PHOTOS_PATH: string`
- [ ] `PHOTOS_PATH` se inicializa como `process.env.PHOTOS_PATH ?? '/photos'`
- [ ] Los 7 archivos que definen la constante localmente la eliminan e importan desde `config.ts`:
  - `src/app/api/photos/[id]/thumbnail/route.ts`
  - `src/app/api/photos/[id]/original/route.ts`
  - `src/app/api/ai/classify/[photoId]/route.ts`
  - `src/app/api/ai/classify/batch/route.ts`
  - `src/app/api/ai/classify/year/route.ts`
  - `src/app/api/ai/review/[photoId]/route.ts`
  - `src/lib/folderWatcher.ts`

### `getPeriodKey` y `formatLabel` en timelineUtils.ts
- [ ] Se crea `src/lib/timelineUtils.ts` con las funciones puras `getPeriodKey(date: Date, zoom: number): string` y `formatLabel(periodKey: string, zoom: number): string`
- [ ] `src/app/api/timeline/route.ts` importa las funciones de `timelineUtils.ts` y elimina su implementación local
- [ ] `src/app/timeline/TimelineClient.tsx` importa las funciones de `timelineUtils.ts` y elimina su implementación local
- [ ] El comportamiento de agrupación y formato de etiquetas es idéntico al actual

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/db.ts` | Añadir `upsertPhotoTags()` y `buildPhotoQuery()` + tipo `PhotoFilters` |
| `src/lib/config.ts` | Crear/ampliar con `PHOTOS_PATH` exportado |
| `src/lib/timelineUtils.ts` | Nuevo módulo con `getPeriodKey` y `formatLabel` |
| `src/app/api/ai/classify/[photoId]/route.ts` | Usar `upsertPhotoTags` |
| `src/app/api/ai/classify/batch/route.ts` | Usar `upsertPhotoTags` |
| `src/app/api/ai/classify/year/route.ts` | Usar `upsertPhotoTags` |
| `src/lib/folderWatcher.ts` | Usar `upsertPhotoTags`, importar `PHOTOS_PATH` |
| `src/app/api/ai/search/route.ts` | Usar `upsertPhotoTags`, usar `buildPhotoQuery` |
| `src/app/api/photos/route.ts` | Usar `buildPhotoQuery`, importar `PHOTOS_PATH` |
| `src/app/api/photos/groups/route.ts` | Usar `buildPhotoQuery` |
| `src/app/library/page.tsx` | Usar `buildPhotoQuery` |
| `src/app/api/photos/[id]/thumbnail/route.ts` | Importar `PHOTOS_PATH` |
| `src/app/api/photos/[id]/original/route.ts` | Importar `PHOTOS_PATH` |
| `src/app/api/ai/review/[photoId]/route.ts` | Importar `PHOTOS_PATH` |
| `src/app/api/timeline/route.ts` | Importar de `timelineUtils.ts` |
| `src/app/timeline/TimelineClient.tsx` | Importar de `timelineUtils.ts` |

---

## Notas técnicas

- Esta es una refactorización con riesgo de regresión. Se recomienda ejecutar todos los tests existentes antes y después, y verificar manualmente los flujos de clasificación y búsqueda.
- `buildPhotoQuery` debe retornar un objeto `{ sql: string; params: ... }` donde `sql` incluye el `WHERE` (y posiblemente el `ORDER BY` y `LIMIT` parametrizables). Las diferencias entre las 4 copias actuales deben analizarse antes de unificar para no perder comportamientos específicos por ruta.
- `upsertPhotoTags` puede usar `db.transaction()` de `better-sqlite3` para encapsular la transacción de forma síncrona.
- `timelineUtils.ts` no debe importar nada de `better-sqlite3` ni de Next.js — debe ser un módulo puro de lógica de fechas.

---

## Fuera de alcance (v1)

- Refactorizar las queries de estadísticas (`stats/page.tsx`) a una capa de servicios
- Extraer `ThemeListSection` y `ScanControls` de `Sidebar.tsx` como sub-componentes separados
- Migrar a un ORM (Drizzle, Prisma) — el scope de esta US es solo centralizar el código existente
