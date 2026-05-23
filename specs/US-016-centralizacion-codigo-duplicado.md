# Feature: Centralización de código duplicado — helpers de DB y configuración

## Historia de usuario

Como desarrollador de photoshelf,
quiero que las funciones de acceso a datos y la configuración global estén en un único lugar,
para que cada nueva feature no tenga que reimplementar la misma lógica ni copiar las mismas constantes.

---

## Descripción

El análisis de deuda técnica identificó varios patrones duplicados en el codebase:

- `upsertPhotoTags` (o lógica equivalente de DELETE+INSERT) aparece en ≥5 archivos
- `buildPhotoQuery` (o lógica de filtros WHERE) se re-implementa en ≥4 rutas de API
- `PHOTOS_PATH` se define con `process.env.PHOTOS_PATH ?? '/photos'` en ≥7 archivos

Esta US extrae cada patrón a un módulo compartido, eliminando la duplicación antes de que
EPIC-002 (API iOS) y EPIC-001 (múltiples catálogos) multipliquen la deuda.

Esta US es el prerequisito recomendado para US-022 (capa de repositorio), aunque no es bloqueante.

---

## Criterios de aceptación

### `upsertPhotoTags` centralizado
- [ ] Existe `src/lib/db-helpers.ts` (o similar) con la función `upsertPhotoTags(db, photoId, tags[])`
- [ ] La función hace DELETE de tags existentes + INSERT de los nuevos en una transacción
- [ ] Todos los archivos que hacían DELETE+INSERT inline importan y usan esta función
- [ ] El comportamiento externo es idéntico (mismas queries, mismos resultados)

### `buildPhotoQuery` centralizado
- [ ] Existe una función `buildPhotoQuery(filters)` que construye el SQL WHERE + parámetros
- [ ] Acepta filtros: `year`, `event`, `tags[]`, `search`, `catalogId?`
- [ ] Todos los endpoints que construían el WHERE inline usan esta función
- [ ] El resultado de las queries es idéntico al comportamiento anterior

### `PHOTOS_PATH` único
- [ ] El valor de `PHOTOS_PATH` se lee de `src/lib/config.ts` (ya creado en US-015)
- [ ] Ningún otro archivo define `process.env.PHOTOS_PATH ?? '/photos'` — todos importan desde config
- [ ] `src/lib/config.ts` es el único punto de configuración de rutas de archivos

### Calidad
- [ ] Build de producción (`npm run build`) pasa sin errores de tipo
- [ ] El comportamiento de todas las rutas API es idéntico antes y después de la refactorización
- [ ] No hay cambios en contratos de API pública

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/db-helpers.ts` | Nuevo — `upsertPhotoTags`, `buildPhotoQuery` |
| `src/lib/config.ts` | Ampliar — ya existe `resolvePhotoPath`, añadir `PHOTOS_PATH` si no está |
| `src/app/api/photos/route.ts` | Usar `buildPhotoQuery` |
| `src/app/api/tags/[photoId]/route.ts` | Usar `upsertPhotoTags` |
| `src/app/api/scan/route.ts` | Usar `upsertPhotoTags` |
| Otros con duplicación | Identificar en implementación y migrar |

---

## Notas técnicas

- Esta US es puramente interna — no modifica ningún contrato externo (API, UI)
- El orden de migración: primero identificar todos los usos con grep, luego centralizar, luego migrar uno a uno
- Usar TypeScript strict para que el compilador detecte usos no migrados
- `buildPhotoQuery` puede devolver `{ sql: string, params: unknown[] }` para ser compatible con `better-sqlite3`

---

## Fuera de alcance (v1)

- ORM o query builder (Drizzle, Knex) — se mantiene SQL directo
- Migración a la capa de repositorio completa (ver US-022)
- Tests unitarios de los helpers (deseable pero no bloqueante)
