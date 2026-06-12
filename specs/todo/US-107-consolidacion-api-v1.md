# Feature: Consolidación de la doble superficie de API (legacy vs v1)

## Historia de usuario

Como desarrollador de photoshelf,
quiero una sola implementación de cada endpoint de la API,
para no mantener dos versiones de photos/timeline/catalogs/tags que pueden divergir silenciosamente.

---

## Descripción

EPIC-002 creó la capa `/api/v1/*` (10 routes) con un patrón superior al legacy: wrapper `withAuth`, respuestas `apiSuccess/apiError` estandarizadas y paginación por cursor. Estaba pensada para clientes externos (iOS, US-024/US-025).

El tech debt audit del 2026-06-12 verificó los ~55 `fetch()` del frontend: **ninguno usa v1** — todo va contra las rutas legacy. Resultado: dos implementaciones paralelas de listado de fotos, timeline, catálogos y tags que ya divergen (v1 pagina por cursor, legacy por offset; v1 valida la paginación después de ejecutar la query — bug en `v1/photos/route.ts:20-28`).

Esta US fuerza la decisión y la ejecuta: o el frontend migra a v1 y las rutas legacy duplicadas se eliminan, o v1 se elimina hasta que exista un cliente externo real.

---

## Criterios de aceptación

### Decisión documentada
- [ ] Decisión registrada en la spec de EPIC-002: migrar frontend a v1 / retirar v1 / mantener v1 congelada solo para iOS (con justificación)

### Si se migra el frontend a v1
- [ ] Los `fetch()` de photos, timeline, catalogs y tags apuntan a `/api/v1/*`
- [ ] Las rutas legacy equivalentes se eliminan o devuelven 308 a v1
- [ ] El bug de validación post-query de `v1/photos` queda corregido

### Si se retira v1
- [ ] Las 10 routes de `src/app/api/v1/` se eliminan
- [ ] `withAuth`/`apiSuccess` de `src/lib/api.ts` se conservan y se adoptan progresivamente en las rutas legacy (son el patrón mejor)
- [ ] EPIC-002 y US-024/US-025 se actualizan para reflejar el estado

### En ambos casos
- [ ] `grep fetch(` del frontend no encuentra ninguna ruta sin handler
- [ ] Los tests de integración de rutas (US-048) siguen en verde

---

## Notas técnicas

- Recomendación del audit: **migrar a v1** — el patrón `withAuth` elimina el boilerplate de auth repetido en ~70 handlers y la paginación por cursor es la que PhotoGrid necesita para US-105.
- La migración puede hacerse por dominio (primero photos, luego timeline…) para mantener PRs pequeñas.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/v1/**` | Destino según decisión |
| `src/components/PhotoGrid.tsx`, `TimelineClient.tsx`, etc. | fetch() actualizados (si migración) |
| `specs/todo/EPIC-002-api-publica-clientes-externos.md` | Decisión documentada |

---

## Fuera de alcance (v1)

- Versionado semántico de la API pública / OpenAPI spec
- Autenticación por API key para clientes externos
