# Épica: API pública para clientes externos (iOS-ready)

> **Estado: 🗂 Planificada**

---

## Visión general

Hoy photoshelf es una app web monolítica donde los **Server Components de Next.js acceden directamente a SQLite** con SQL inline, saltándose la capa de API. Los route handlers existen y exponen datos, pero no están diseñados pensando en un cliente externo: no tienen paginación consistente, no tienen versionado, los errores no tienen un formato uniforme, y la autenticación (basada en sesión HTTP) funciona bien para un navegador pero no está validada para una app nativa iOS.

El motivo que eleva esta épica de "mejora de calidad interna" a "prioridad estratégica" es la posibilidad de construir una **app nativa iOS**. Una app nativa no puede llamar a Server Components de Next.js ni acceder a SQLite directamente — necesita una API HTTP limpia con contratos estables. Si se diseña bien ahora, la misma API sirve tanto a la web como a la app sin duplicar lógica.

El enfoque es **pragmático, no purista**: no se obliga a los Server Components a pasar por HTTP (añadiría latencia innecesaria en server-side). En cambio:
1. Se crea una **capa de repositorio** en `src/lib/queries/` que centraliza el acceso a datos — tanto los server components como los route handlers la usan.
2. Se **revisan y estandarizan los contratos** de los route handlers existentes para que sean consumibles por un cliente iOS.
3. Se **añaden o completan los endpoints** que la app iOS necesitará y que hoy no existen o están incompletos.

Esta épica está **explícitamente enlazada con EPIC-001** (múltiples catálogos): todos los endpoints diseñados aquí incluyen el parámetro `catalogId` opcional para que cuando EPIC-001 se implemente, no haya que rediseñar los contratos. El identificador del catálogo por defecto es `1`.

---

## Problema técnico actual

| Problema | Dónde está en el código |
|---|---|
| SQL inline en Server Components | `stats/page.tsx` (10+ queries), `library/page.tsx` (5+ queries) |
| `PHOTOS_PATH` redefinido en 7 archivos | `thumbnail/route.ts`, `original/route.ts`, `classify/*/route.ts`, etc. |
| Sin envelope de respuesta consistente | Algunos devuelven `{ photos: [] }`, otros `{ groups: [] }`, errores sin formato estándar |
| Sin paginación en algunos endpoints críticos | `/api/timeline` devuelve todos los periodos de golpe |
| Sin versionado de API | Cambios breaking afectan a todos los clientes sin gestión |
| Autenticación inconsistente | Algunas rutas no verifican sesión; cookie-based no probado desde iOS |
| Sin endpoint de detalle completo de foto | `GET /api/photos/[id]` retorna datos mínimos sin EXIF completo ni themes |

---

## Relación con otras épicas y USes

| Épica / US | Relación |
|---|---|
| **EPIC-001** (múltiples catálogos) | EPIC-002 diseña los contratos con `catalogId` desde el inicio para que EPIC-001 no requiera breaking changes |
| **US-016** (centralización código duplicado) | US-016 extrae helpers de query-building; EPIC-002/US-022 va más lejos creando una capa de repositorio completa que US-016 puede usar como base |
| **US-014** (hardening auth) | US-014 añade rate limiting y validaciones; EPIC-002/US-024 diseña el mecanismo de auth para clientes externos |

---

## Historias hijas

| ID | Título | Dependencias | Estado |
|---|---|---|---|
| [US-022](US-022-capa-repositorio-queries.md) | Capa de repositorio — eliminar SQL inline en pages | — | ⬜ Pendiente |
| [US-023](US-023-contratos-api-estandar.md) | Contratos de API — envelope, errores y versionado | US-022 | ⬜ Pendiente |
| [US-024](US-024-endpoints-ios-browse.md) | Endpoints iOS — timeline, detalle de foto y thumbnails | US-022 + US-023 | ⬜ Pendiente |
| [US-025](US-025-endpoints-ios-acciones.md) | Endpoints iOS — búsqueda, tags, scan y autenticación | US-022 + US-023 | ⬜ Pendiente |

---

## Orden de ejecución recomendado

```
US-022 ──► US-023 ──┬──► US-024
                    └──► US-025
```

**Fase 1 — Fundamento invisible**: `US-022` — la web sigue funcionando igual, pero el acceso a datos está centralizado. Sin cambios en la API pública.

**Fase 2 — Contratos**: `US-023` — estandarizar respuestas y errores. Los clientes web existentes deben adaptarse; los nuevos clientes iOS ya consumen el formato correcto.

**Fase 3 — Endpoints iOS** (paralelizables): `US-024` + `US-025` — completar la superficie de API que la app iOS necesita para implementar sus flujos principales.

---

## Fuera de alcance de la épica

- Implementación de la app iOS (esta épica solo prepara el backend)
- Autenticación OAuth / SSO / multi-tenant
- WebSockets para notificaciones en tiempo real (el polling de estado de scan es suficiente para v1)
- Rate limiting por API key (se cubre parcialmente en US-014 para el login)
- Documentación OpenAPI/Swagger generada automáticamente
- SDK de cliente para iOS (puede generarse desde OpenAPI en el futuro)
