# Feature: Capa de repositorio — eliminar SQL inline en Server Components

> **Estado: ✅ Desplegada** — merged en main el 2026-05-24 (PR #37)

## Historia de usuario

Como desarrollador de photoshelf,
quiero que todo el acceso a SQLite pase por funciones en `src/lib/queries/`,
para que los Server Components no importen `better-sqlite3` directamente y la lógica de datos sea reutilizable desde cualquier capa.

---

## Descripción

Actualmente hay dos patrones de acceso a datos conviviendo en el codebase: los **route handlers** (`src/app/api/`) hacen queries a SQLite, y los **Server Components** (`stats/page.tsx`, `library/page.tsx`) también hacen queries a SQLite directamente con SQL inline. Esto significa que la misma lógica de datos existe duplicada y en lugares que no están diseñados para contenerla.

Esta US crea una **capa de repositorio** en `src/lib/queries/` (o `src/lib/repository/`) con funciones tipadas para cada dominio de datos. Ni los Server Components ni los route handlers deben importar `getDb()` o escribir SQL directamente — en su lugar, llaman a funciones como `photoQueries.list(filters)`, `statsQueries.byYear(year)` o `timelineQueries.periods(zoom)`.

El resultado es:
1. **Un solo lugar** donde cambiar una query (crucial cuando llegue EPIC-001 con `catalog_id`).
2. **Server components y route handlers reutilizan el mismo código** — sin duplicación.
3. **Testeabilidad**: las funciones de repositorio son mockeables sin levantar Next.js.

Esta US es el prerequisito fundamental de EPIC-002 y complementa US-016 (que centraliza helpers de query-building dentro del patrón actual).

---

## Criterios de aceptación

### Módulos del repositorio
- [ ] Se crea la estructura `src/lib/queries/` con al menos estos módulos:
  - `photos.ts` — `list(filters)`, `getById(id)`, `count(filters)`, `getMap()`
  - `groups.ts` — `listGroups(filters)`, `getGroup(event, year)`
  - `tags.ts` — `listAll()`, `listByPhoto(photoId)`, `upsert(photoId, tags)`
  - `themes.ts` — `listAll()`, `getById(id)`, `create(name)`, `update(id, name)`, `delete(id)`
  - `timeline.ts` — `getPeriods(zoom, filters)`, `getPhotosByPeriod(periodKey)`
  - `stats.ts` — `getYearlyStats(year)`, `getMonthlyDistribution(year)`, `getTopTags(limit)`
  - `catalog.ts` — `getDefault()` (stub para EPIC-001; devuelve `{ id: 1 }` por ahora)
- [ ] Cada función tiene tipos de retorno explícitos en TypeScript (sin `any`)
- [ ] Cada módulo acepta un parámetro opcional `catalogId?: number` (default: `1`) para estar preparado para EPIC-001

### Migración de Server Components
- [ ] `src/app/stats/page.tsx` elimina todas las queries SQLite inline y las reemplaza por llamadas a `statsQueries.*`
- [ ] `src/app/library/page.tsx` elimina las queries inline y usa `photoQueries.list(filters)` y `groupQueries.listGroups(filters)`
- [ ] Ningún archivo en `src/app/*/page.tsx` importa `getDb()` ni `better-sqlite3` directamente tras la migración

### Migración de route handlers
- [ ] Los route handlers en `src/app/api/` que duplican lógica ya en los queries pasan a usar las funciones del repositorio
- [ ] Los route handlers siguen siendo responsables del parsing de request params, validación y construcción de la Response — no de la lógica de datos

### Coexistencia segura
- [ ] El comportamiento de todas las rutas y pages es idéntico antes y después de la migración (no hay cambios en el contrato externo)
- [ ] Los tests existentes siguen pasando
- [ ] El build de producción (`npm run build`) completa sin errores de tipo

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/queries/photos.ts` | Nuevo — queries de fotos con filtros |
| `src/lib/queries/groups.ts` | Nuevo — queries de grupos/eventos |
| `src/lib/queries/tags.ts` | Nuevo — queries de tags (reemplaza inline + upsertPhotoTags de US-016) |
| `src/lib/queries/themes.ts` | Nuevo — CRUD de temáticas |
| `src/lib/queries/timeline.ts` | Nuevo — queries de periodos del timeline |
| `src/lib/queries/stats.ts` | Nuevo — queries de estadísticas |
| `src/lib/queries/catalog.ts` | Nuevo — stub para EPIC-001 |
| `src/lib/queries/index.ts` | Re-export de todos los módulos |
| `src/app/stats/page.tsx` | Eliminar SQL inline, usar `statsQueries.*` |
| `src/app/library/page.tsx` | Eliminar SQL inline, usar `photoQueries.*` + `groupQueries.*` |
| `src/app/api/photos/route.ts` | Usar `photoQueries.list()` |
| `src/app/api/photos/groups/route.ts` | Usar `groupQueries.listGroups()` |
| `src/app/api/themes/route.ts` | Usar `themeQueries.*` |
| `src/app/api/tags/[photoId]/route.ts` | Usar `tagQueries.*` |
| `src/app/api/timeline/route.ts` | Usar `timelineQueries.*` |

---

## Notas técnicas

- Las funciones del repositorio deben ser **síncronas** (como lo es `better-sqlite3`) o devolver `Promise` — documentar cuál se elige y ser consistente en todo el módulo. Recomendación: síncronas para mantener la compatibilidad con el código existente.
- Cada función de repositorio llama internamente a `getDb()` para obtener la instancia de la DB. No se pasa la DB como argumento (pattern repository, no DAO puro).
- El parámetro `catalogId` se añade como `WHERE p.catalog_id = ?` en todas las queries que afectan a fotos. Con `catalogId = 1` por defecto, el comportamiento actual no cambia.
- Esta US **no cambia ningún contrato de API pública** — es puramente una refactorización interna.
- Relación con **US-016**: US-016 extrae `upsertPhotoTags`, `buildPhotoQuery` y `PHOTOS_PATH`. Esta US puede absorber esos helpers dentro del módulo de repositorio correspondiente, o reutilizarlos. Recomendado: primero US-016, luego US-022 los incorpora.

---

## Fuera de alcance (v1)

- ORM (Drizzle, Prisma) — el repositorio usa SQL directo con `better-sqlite3`
- Caché de resultados en memoria (puede añadirse sobre las funciones del repositorio en el futuro)
- Transactions que abarquen múltiples módulos del repositorio (quedan dentro de funciones específicas)
- Testing de las funciones del repositorio con una DB in-memory (deseable pero no bloqueante para esta US)
