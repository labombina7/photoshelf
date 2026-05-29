# Feature: Capa de repositorio — eliminar SQL inline restante en route handlers

## Historia de usuario

Como desarrollador de photoshelf,
quiero que ningún route handler ni componente importe `getDb()` directamente,
para que toda la lógica de acceso a datos esté centralizada en `src/lib/queries/` y sea fácil de mantener, testear y auditar.

---

## Descripción

La US-022 (Capa de repositorio) fue desplegada y estableció la arquitectura de repositorio para Server Components y las queries principales. Sin embargo, la auditoría de deuda técnica del 2026-05-29 identificó que al menos 12 ficheros de routes/pages siguen importando `getDb()` directamente y ejecutando SQL inline:

- `src/app/api/search/hints/route.ts`
- `src/app/api/search/suggestions/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/generate/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/ai/search/route.ts`
- y al menos 6 ficheros más

Adicionalmente, `getSidebarProjects` es una query de repositorio que vive en `db.ts` junto con la inicialización de la base de datos, violando la separación de responsabilidades.

Esta US es el paso final para completar la migración a la arquitectura de repositorio definida en CLAUDE.md y en US-022.

---

## Criterios de aceptación

### Nuevas funciones de repositorio
- [ ] `src/lib/queries/search.ts` existe con:
  - `getSearchHints(catalogId: number): string[]`
  - `getSearchSuggestions(query: string, catalogId: number): string[]`
  - `getAiSearchCandidates(catalogId: number): Photo[]` (para el modo deep)
- [ ] `src/lib/queries/projects.ts` existe con:
  - `getProjectList(catalogId: number): Project[]`
  - `getProjectById(id: number): Project | undefined`
  - `createProject(data: CreateProjectInput): Project`
  - `updateProject(id: number, data: Partial<Project>): void`
  - `deleteProject(id: number): void`
  - `getProjectPhotos(projectId: number): Photo[]`
  - `setProjectPhotos(projectId: number, photoIds: number[]): void`

### Migración de route handlers
- [ ] Ningún route handler en `src/app/api/search/` importa `getDb()` directamente
- [ ] Ningún route handler en `src/app/api/projects/` importa `getDb()` directamente
- [ ] `src/app/api/ai/search/route.ts` usa la función de repositorio para obtener los candidatos
- [ ] Los otros 6+ ficheros identificados también están migrados

### `getSidebarProjects` movida a queries
- [ ] `getSidebarProjects` se mueve a `src/lib/queries/sidebar.ts` (o `queries/projects.ts` si ya existe)
- [ ] Los importadores en `projects/page.tsx` y `projects/[id]/page.tsx` se actualizan
- [ ] `db.ts` solo contiene `getDb()` y `initSchema()` — sin lógica de dominio

### Sin regresiones
- [ ] Todos los endpoints afectados responden con los mismos datos que antes
- [ ] Los tests existentes siguen pasando
- [ ] No se introducen nuevas queries N+1

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/queries/search.ts` | Nuevo — funciones de repositorio para búsqueda y hints |
| `src/lib/queries/projects.ts` | Nuevo (o ampliar existente) — funciones de repositorio para proyectos |
| `src/lib/queries/sidebar.ts` | Nuevo — `getSidebarProjects` |
| `src/lib/db.ts` | Eliminar `getSidebarProjects`; solo `getDb()` e `initSchema()` |
| `src/app/api/search/hints/route.ts` | Usar `getSearchHints` |
| `src/app/api/search/suggestions/route.ts` | Usar `getSearchSuggestions` |
| `src/app/api/projects/route.ts` | Usar `getProjectList`, `createProject` |
| `src/app/api/projects/generate/route.ts` | Usar funciones de repositorio |
| `src/app/api/projects/[id]/route.ts` | Usar `getProjectById`, `updateProject`, `deleteProject` |
| `src/app/api/ai/search/route.ts` | Usar `getAiSearchCandidates` |

---

## Notas técnicas

- Seguir el patrón establecido en `src/lib/queries/photos.ts`: funciones que reciben `db` como parámetro o usan `getDb()` internamente según la convención del proyecto
- El `catalog_id` debe propagarse correctamente a todas las nuevas funciones (patrón ya establecido en EPIC-001)
- Verificar que `getAiSearchCandidates` incluye el filtro de `catalog_id` — el bug actual en `/api/ai/search` modo deep es que busca en todos los catálogos

---

## Fuera de alcance (v1)

- Unificar los endpoints `/api/photos/*` y `/api/v1/photos/*` (requiere US propia de migración)
- Añadir tests unitarios para las nuevas funciones de repositorio (cubrir en US-048)
- Integrar el modo deep de `/api/ai/search` en `/api/search?mode=deep`
