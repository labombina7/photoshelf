# Feature: Modo invitado — acceso de solo lectura con PIN separado

## Historia de usuario

Como propietario de la biblioteca,
quiero un acceso de invitado con PIN propio y permisos de solo lectura,
para que mi familia pueda explorar las fotos desde sus dispositivos sin poder borrar, etiquetar ni reconfigurar nada.

---

## Descripción

photoshelf tiene una única contraseña (`APP_PASSWORD`) que otorga control total: quien la tiene puede borrar temáticas, lanzar reclasificaciones, cambiar catálogos o eliminar proyectos. En un hogar, lo habitual es querer compartir la *exploración* (biblioteca, timeline, mapa, memorias, búsqueda) sin compartir la *administración*.

Esta feature añade un segundo credencial opcional (`GUEST_PASSWORD`) que crea sesiones con rol `guest`. La sesión de invitado puede navegar y buscar todo, pero cualquier mutación (favoritos, tags, temáticas, proyectos, ajustes, escaneos, compartir) está bloqueada en servidor y oculta en cliente. El login actual gana un comportamiento transparente: se comprueba primero la contraseña admin y luego la de invitado — sin selector de rol, la misma pantalla.

Aprovecha la infraestructura existente: `SessionData` de iron-session gana `role`, y el wrapper de auth (o un helper `requireAdmin`) concentra el enforcement.

---

## Criterios de aceptación

### Autenticación
- [ ] `GUEST_PASSWORD` opcional en env (documentada en `.env.example`); si no está definida, nada cambia
- [ ] El login acepta ambas contraseñas y asigna `role: 'admin' | 'guest'` en la sesión
- [ ] Comparación timing-safe también para el PIN de invitado

### Enforcement en servidor
- [ ] Todas las rutas mutadoras (POST/PATCH/PUT/DELETE excepto login/logout) devuelven 403 para sesiones guest
- [ ] El enforcement vive en un único helper (`requireAdmin(session)`) — no copiado por ruta
- [ ] Las rutas de lectura (photos, timeline, map, search, memories, stats, thumbnails) funcionan igual para guest

### UI adaptada
- [ ] En sesión guest se ocultan: estrellas de favorito, edición de tags/temáticas, botones de IA, reescanear, ajustes, compartir, selección
- [ ] Indicador discreto «Invitado» en el sidebar con opción de cerrar sesión
- [ ] Intentar una acción bloqueada por URL directa muestra error claro, no un fallo silencioso

### Tests
- [ ] Test de login con cada credencial → rol correcto
- [ ] Test de 403 en una muestra de rutas mutadoras con sesión guest

---

## API necesaria

- `POST /api/auth/login` — sin cambio de contrato; internamente resuelve el rol
- Helper `requireAdmin` en `src/lib/api.ts` aplicado a rutas mutadoras

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/session.ts` | `role` en SessionData + check de ambas contraseñas |
| `src/lib/api.ts` | `requireAdmin` |
| Rutas mutadoras de `src/app/api/**` | Enforcement |
| `src/components/Sidebar.tsx`, `DetailPanel.tsx`, `FilterBar.tsx`, `PhotoGrid.tsx` | Ocultar acciones según rol |
| `.env.example` | Documentar GUEST_PASSWORD |

---

## Notas técnicas

- El rol debe llegar al cliente vía un endpoint ligero (`/api/auth/me`) o props de servidor — no confiar en estado de cliente para seguridad (la UI solo *oculta*; el servidor *bloquea*).
- El rate limiting de login existente (US-014) debe cubrir ambas contraseñas.
- Sinergia futura: el modo invitado hace más seguro exponer la app fuera de la LAN con TLS.

---

## Fuera de alcance (v1)

- Múltiples usuarios con cuentas individuales
- Permisos granulares (p.ej. invitado que sí puede marcar favoritos)
- Restricción de catálogos o temáticas visibles por rol
