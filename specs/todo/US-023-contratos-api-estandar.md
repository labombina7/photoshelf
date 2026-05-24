# Feature: Contratos de API — envelope estándar, errores y versionado

## Historia de usuario

Como desarrollador de una app iOS que consume la API de photoshelf,
quiero que todos los endpoints devuelvan respuestas con el mismo formato, códigos de error consistentes y un prefijo de versión,
para poder escribir un cliente robusto sin tratar cada endpoint de forma especial.

---

## Descripción

Los route handlers de photoshelf devuelven respuestas heterogéneas: algunos retornan `{ photos: [] }`, otros `{ groups: [] }`, otros un array directo, y los errores pueden ser strings, objetos `{ error: string }` o respuestas 500 sin cuerpo. Un cliente iOS tiene que manejar cada endpoint de forma ad-hoc, lo que hace el cliente frágil y dificulta añadir nuevas funcionalidades.

Esta US establece un **contrato estándar** para todos los endpoints de la API:

1. **Envelope de respuesta uniforme**: `{ data: T, meta?: PaginationMeta, error?: string }`
2. **Formato de error estándar**: `{ error: string, code: string, status: number }`
3. **Paginación consistente**: cursor-based o offset-based con los mismos parámetros en todos los endpoints de lista
4. **Versionado de prefijo**: `/api/v1/` — los endpoints actuales siguen funcionando bajo `/api/` para no romper la web; los nuevos se crean bajo `/api/v1/`
5. **Autenticación verificada en todas las rutas**: ningún endpoint de datos devuelve resultados sin sesión activa

---

## Criterios de aceptación

### Envelope de respuesta
- [ ] Se define el tipo `ApiResponse<T>` en `src/lib/api.ts`:
  ```typescript
  type ApiResponse<T> = {
    data: T;
    meta?: {
      total?: number;
      page?: number;
      limit?: number;
      hasMore?: boolean;
      nextCursor?: string;
    };
  };
  ```
- [ ] Se define `ApiError`:
  ```typescript
  type ApiError = {
    error: string;
    code: string;   // ej. "UNAUTHORIZED", "NOT_FOUND", "DB_ERROR"
    status: number;
  };
  ```
- [ ] Se crea un helper `apiSuccess<T>(data: T, meta?): NextResponse` que devuelve el envelope correcto
- [ ] Se crea un helper `apiError(code, message, status): NextResponse` que devuelve el formato de error
- [ ] HTTP Status codes son semánticamente correctos: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 429 Too Many Requests, 500 Internal Server Error

### Versionado
- [ ] Los endpoints existentes bajo `/api/` se mantienen sin cambios (compatibilidad para la web)
- [ ] Los endpoints nuevos y revisados se crean bajo `/api/v1/` como rutas paralelas que usan las mismas funciones de repositorio (US-022)
- [ ] El prefijo `/api/v1/` se implementa como un route group en Next.js App Router: `src/app/api/v1/`
- [ ] Un middleware o helper en `src/lib/api.ts` verifica la sesión automáticamente para todas las rutas bajo `/api/v1/`

### Autenticación en `/api/v1/`
- [ ] Todas las rutas bajo `/api/v1/` verifican la sesión antes de ejecutar la lógica
- [ ] Si no hay sesión activa, devuelven `ApiError { code: "UNAUTHORIZED", status: 401 }`
- [ ] La verificación se hace en un middleware de Next.js (`src/middleware.ts`) para las rutas `/api/v1/*`
- [ ] Las cookies de sesión de iron-session funcionan desde iOS (verificado: `Set-Cookie` con `httpOnly`, `SameSite=Lax`)

### Paginación estándar
- [ ] Los endpoints de lista aceptan los parámetros: `?limit=50&offset=0` (offset-based, máx. 200)
- [ ] O bien `?limit=50&cursor=<opaque_string>` para cursor-based (preferido para iOS scroll infinito)
- [ ] La respuesta incluye `meta.total`, `meta.hasMore`, y `meta.nextCursor` si aplica
- [ ] El límite por defecto es 50; el máximo es 200

### Documentación interna
- [ ] Se crea `docs/api-v1.md` con la lista de endpoints `/api/v1/`, sus parámetros y ejemplos de respuesta
- [ ] El documento incluye la sección de autenticación (cómo hacer login desde iOS: `POST /api/auth/login` → cookie de sesión → usar en todas las peticiones)

---

## API necesaria

### Helpers internos (no endpoints)
```typescript
// src/lib/api.ts
export function apiSuccess<T>(data: T, meta?: PaginationMeta): NextResponse
export function apiError(code: string, message: string, status: number): NextResponse
export function withAuth(handler: AuthedHandler): RouteHandler  // HOF para verificar sesión
export function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number }
```

### Middleware de autenticación
```
src/middleware.ts — matcher: ['/api/v1/:path*']
```

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/api.ts` | Nuevo — helpers `apiSuccess`, `apiError`, `withAuth`, `parsePagination`, tipos |
| `src/middleware.ts` | Nuevo o modificado — verificar sesión para `/api/v1/*` |
| `src/app/api/v1/` | Nuevo directorio — route group para la API versionada |
| `docs/api-v1.md` | Nuevo — documentación de contratos para consumidores externos |

---

## Notas técnicas

- **¿Offset o cursor?** Para listas de fotos ordenadas por fecha, cursor-based es más robusto (no tiene el problema de "foto nueva inserta antes del offset"). El cursor puede ser el `taken_at` + `id` de la última foto vista, encoded en base64.
- El **middleware de Next.js** para verificar sesión es más eficiente que verificar en cada route handler individualmente. Usar `getIronSession` dentro del middleware puede tener limitaciones — alternativamente, usar el HOF `withAuth` como wrapper por handler.
- **iOS y cookies**: `URLSession` de iOS maneja cookies automáticamente si se usa `HTTPCookieStorage`. El flujo es: `POST /api/auth/login` → servidor devuelve `Set-Cookie: photoshelf_session=...` → iOS almacena la cookie → se envía automáticamente en peticiones posteriores al mismo dominio.
- Los **endpoints existentes bajo `/api/`** no se modifican. La web sigue consumiendo `/api/photos`, `/api/timeline`, etc. Los endpoints `/api/v1/` son nuevos y usan el mismo repositorio (US-022) bajo el capó.

---

## Fuera de alcance (v1)

- Autenticación por Bearer token / JWT (la cookie de sesión es suficiente para iOS v1)
- Rate limiting por API key (cubierto en US-014 para el login)
- OpenAPI / Swagger spec generada automáticamente
- Versionado mayor (`/api/v2/`) — se hace cuando haya breaking changes reales
- CORS para orígenes externos (la app iOS llama directamente al NAS en la misma red)
