# Feature: US-009b — Contexto de catálogo activo en el servidor

## Historia de usuario

Como usuario de photoshelf con múltiples catálogos,
quiero que la app recuerde qué catálogo estoy usando entre peticiones,
para que al navegar entre vistas siempre vea las fotos del catálogo correcto.

---

## Descripción

Introduce el concepto de "catálogo activo" como parte de la sesión de usuario.
Cuando el usuario cambia de catálogo, el `catalog_id` activo se guarda en la sesión
(iron-session) y todas las rutas API leen este valor para filtrar sus queries.

---

## Criterios de aceptación

### Sesión
- [ ] `SessionData` incluye el campo `catalogId?: number` (default: `1`)
- [ ] Al hacer login, `catalogId` se inicializa a `1` si no tiene valor
- [ ] El endpoint `POST /api/catalogs/switch` cambia el `catalogId` en la sesión y devuelve el nuevo catálogo

### Helper de servidor
- [ ] Existe la función `getActiveCatalogId(): Promise<number>` que lee `session.catalogId ?? 1`
- [ ] Esta función es usada por todos los route handlers para obtener el `catalogId` activo

### Sin cambios en la UI todavía
- [ ] Esta US sólo establece la infraestructura — la UI del selector se implementa en US-009f
- [ ] El comportamiento por defecto (catalog_id = 1) no cambia nada para el usuario actual

---

## API necesaria

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/catalogs/switch` | POST | Body: `{ catalogId: number }` → guarda en sesión, devuelve `{ catalog: Catalog }` |

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/session.ts` | Añadir `catalogId?: number` a `SessionData` |
| `src/lib/catalog-context.ts` | Nuevo — `getActiveCatalogId()` |
| `src/app/api/catalogs/switch/route.ts` | Nuevo — endpoint de cambio de catálogo |

---

## Fuera de alcance

- UI del selector de catálogo (US-009f)
- Filtrado de queries por catalogId (US-009c)
