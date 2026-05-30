# Feature: Hardening de seguridad — rate limiting en IA, middleware universal y validación de catálogos

## Historia de usuario

Como administrador de photoshelf,
quiero que los endpoints que consumen recursos intensivos (IA, clasificación) estén protegidos contra abuso,
para que un uso incorrecto o un ataque no bloquee Ollama ni exponga rutas del sistema de archivos.

---

## Descripción

La auditoría de deuda técnica identificó tres vulnerabilidades de seguridad que no fueron cubiertas por las US anteriores (US-014 y US-015):

**1. Rate limiting solo en login**: los endpoints `/api/ai/classify/batch`, `/api/ai/search`, `/api/ai/review/[photoId]` y similares no tienen protección contra abuso. Un usuario autenticado puede lanzar peticiones en bucle que saturen Ollama, agoten CPU/RAM del NAS o provoquen denegación de servicio. El sistema de classify ya tiene un mutex (`classifyState.running`) para operaciones batch, pero no para review ni para search.

**2. Middleware de autenticación limitado a `/api/v1/*`**: el middleware de Next.js (`src/middleware.ts`) solo aplica el check de sesión sobre las rutas v1. Los demás endpoints (`/api/photos/*`, `/api/ai/*`, `/api/scan`, etc.) dependen del check manual `getSession()` en cada handler. Si un handler futuro omitiera ese check, no habría ninguna barrera de contención. Además, el middleware solo comprueba la presencia de la cookie, no su validez criptográfica.

**3. Catálogos con paths arbitrarios**: al crear un catálogo, no se valida que el directorio proporcionado sea accesible y seguro. Un administrador podría crear un catálogo apuntando a `/etc` u otras rutas sensibles del sistema, y el scanner las indexaría.

---

## Criterios de aceptación

### Rate limiting en endpoints de IA
- [ ] `/api/ai/review/[photoId]` tiene un throttle de 1 petición concurrente por sesión (similar al mutex de classify)
- [ ] `/api/ai/search` tiene un guard que rechaza con HTTP 429 si ya hay una búsqueda en curso para la misma sesión
- [ ] Los guards son consistentes con el patrón existente de `classifyState.running` (mutex en `globalThis`)
- [ ] La respuesta 429 sigue el formato estándar: `{ error: 'Operación en curso. Espera a que termine.' }`

### Middleware universal de autenticación
- [ ] El matcher del middleware de Next.js se amplía a `/api/:path*` para cubrir todos los endpoints
- [ ] El middleware valida la sesión usando iron-session (validación criptográfica real, no solo presencia de cookie)
- [ ] Los handlers individuales mantienen su propio `getSession()` como segunda línea de defensa
- [ ] Los endpoints públicos (si los hay) están explícitamente excluidos del matcher

### Validación de directorio al crear catálogo
- [ ] `createCatalog` en `src/lib/queries/catalogs.ts` verifica que el path proporcionado existe y es un directorio antes de persistirlo
- [ ] Si el path no existe o no es un directorio, devuelve error HTTP 400: `{ error: 'El directorio no existe o no es accesible' }`
- [ ] El path se valida con `fs.statSync` o `fs.stat` (consistente con cómo lo hace `src/app/api/scan/route.ts`)
- [ ] Opcionalmente, se valida que el path comienza con un prefijo permitido (configurable vía `ALLOWED_ROOT` env var)

---

## API necesaria

No se añaden endpoints. Se modifica el comportamiento de los existentes:
- `POST /api/ai/review/[photoId]` — añadir guard de concurrencia
- `POST /api/ai/search` — añadir guard de concurrencia
- `POST /api/catalogs` — añadir validación de directorio

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/middleware.ts` | Ampliar matcher a `/api/:path*`; mejorar validación de sesión |
| `src/lib/aiSearchState.ts` (nuevo) | Estado global para throttling de búsqueda IA, análogo a `classifyState.ts` |
| `src/app/api/ai/review/[photoId]/route.ts` | Añadir guard de concurrencia |
| `src/app/api/ai/search/route.ts` | Añadir guard de concurrencia |
| `src/lib/queries/catalogs.ts` | Validación de path en `createCatalog` |

---

## Notas técnicas

- El throttle de búsqueda IA puede reutilizar exactamente el mismo patrón de `classifyState.ts`: un objeto en `globalThis` con `running: boolean` y `startedAt: number`. Si `running === true` en el momento de la petición, devolver 429.
- Para el middleware, ampliar el matcher a `'/api/:path*'` y excluir `/api/auth/login` si ese endpoint debe seguir siendo el punto de entrada de autenticación antes de tener sesión.
- La validación de path en catálogos debe usar `path.resolve()` para canonicalizar y luego `fs.statSync()`. El mismo patrón que ya existe en `scan/route.ts`.

---

## Fuera de alcance (v1)

- Rate limiting basado en IP para endpoints de IA (requiere Redis o solución distribuida)
- Auditoría de accesos con log estructurado
- ALLOWED_ROOT como variable de entorno de producción obligatoria (documentar en README)
- CORS en endpoints de API pública

> Estado: ✅ Desplegada — merged en main el 2026-05-30
