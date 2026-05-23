# Feature: Endpoints iOS — búsqueda, tags, scan y autenticación

## Historia de usuario

Como app nativa iOS de photoshelf,
quiero endpoints para buscar fotos por texto o IA, navegar por tags, disparar un escaneo y autenticarme con sesión persistente,
para implementar las acciones principales de la app sin lógica de negocio en el cliente.

---

## Descripción

Además de las vistas de browsing (US-024), una app iOS necesita acciones: buscar fotos, clasificar por tags, ver el estado de las operaciones en curso y autenticarse de forma persistente entre sesiones. Algunos de estos endpoints ya existen bajo `/api/`, pero no están diseñados para un cliente externo: la búsqueda semántica devuelve resultados sin paginación, el login no documenta el mecanismo de cookies para iOS, y no hay un endpoint unificado de estado de la app (scan + watcher + classify).

Esta US completa la superficie de API bajo `/api/v1/` para cubrir los flujos de acción de la app iOS, siguiendo los contratos de US-023.

---

## Criterios de aceptación

### Autenticación
- [ ] `POST /api/v1/auth/login` acepta `{ password: string }` en el body JSON
- [ ] En éxito: devuelve `{ data: { authenticated: true } }` con header `Set-Cookie: photoshelf_session=...` (HttpOnly, SameSite=Lax)
- [ ] En fallo (password incorrecta): `ApiError { code: "INVALID_CREDENTIALS", status: 401 }`
- [ ] Tras el rate limiting de US-014: `ApiError { code: "RATE_LIMITED", status: 429, error: "Demasiados intentos. Espera 15 minutos." }`
- [ ] `GET /api/v1/auth/me` devuelve `{ data: { authenticated: true } }` si la sesión es válida, o 401 si no — permite a la app iOS verificar si la sesión sigue activa al arrancar
- [ ] `POST /api/v1/auth/logout` invalida la sesión y devuelve 200

### Tags y fotos por tag
- [ ] `GET /api/v1/tags` devuelve todos los tags con conteo:
  ```json
  {
    "data": [
      { "name": "personas", "count": 342, "source": "ai" },
      { "name": "verano", "count": 128, "source": "manual" }
    ],
    "meta": { "total": 47 }
  }
  ```
- [ ] Parámetros opcionales: `?catalogId=1&source=ai|manual|all` (default: all)
- [ ] `GET /api/v1/tags/{tagName}/photos` devuelve las fotos con ese tag, paginadas (mismo formato que `/api/v1/timeline/{period}/photos`)
- [ ] El `tagName` en la URL está URL-encoded para soportar tags con espacios o caracteres especiales

### Búsqueda
- [ ] `GET /api/v1/photos?q=<text>&tag=<tag>&year=<year>&favorite=true&limit=50&cursor=<cursor>` — búsqueda textual por tags/evento/nombre
- [ ] `POST /api/v1/ai/search` acepta `{ query: string, limit?: number }` y devuelve resultados semánticos:
  ```json
  {
    "data": [
      { "id": 1234, "score": 0.92, "thumbnail_url": "/api/v1/photos/1234/thumbnail", "filename": "...", "taken_at": "..." }
    ],
    "meta": { "total": 15, "hasMore": false }
  }
  ```
- [ ] El endpoint de búsqueda semántica requiere Ollama disponible; si no está, devuelve `ApiError { code: "AI_UNAVAILABLE", status: 503 }`
- [ ] El parámetro `query` se sanitiza (máx. 200 caracteres, escapado de XML — reutilizando US-014)

### Favoritos
- [ ] `POST /api/v1/photos/{id}/favorite` alterna el estado favorito (toggle)
- [ ] Respuesta: `{ data: { id: 1234, is_favorite: true } }`
- [ ] `GET /api/v1/photos?favorite=true&limit=50` devuelve solo las fotos favoritas

### Scan y estado de operaciones
- [ ] `POST /api/v1/scan` dispara un escaneo de la biblioteca
  - Si ya hay un scan en curso: `ApiError { code: "SCAN_IN_PROGRESS", status: 409 }`
  - Si el scan se inicia: `{ data: { started: true } }` con 202 Accepted
- [ ] `GET /api/v1/status` devuelve el estado unificado de todas las operaciones en background:
  ```json
  {
    "data": {
      "scan": { "running": false, "progress": 0, "total": 0, "lastRun": "2024-08-15T14:00:00Z" },
      "classify": { "running": false, "processed": 0, "total": 0 },
      "watcher": { "active": true, "watching": ["/photos"] }
    }
  }
  ```
- [ ] Este endpoint consolida las tres fuentes de estado que hoy tienen endpoints separados (`/api/scan/status`, `/api/watcher/status`, `/api/ai/classify/status`)

### Clasificación desde iOS
- [ ] `POST /api/v1/photos/{id}/classify` dispara la clasificación IA de una foto
  - Respuesta: `{ data: { photoId: 1234, tags: ["personas", "interior"], status: "classified" } }`
  - Si Ollama no disponible: `ApiError { code: "AI_UNAVAILABLE", status: 503 }`
- [ ] `POST /api/v1/photos/{id}/tags` añade tags manuales: body `{ tags: ["verano", "vacaciones"] }`
- [ ] `DELETE /api/v1/photos/{id}/tags/{tagName}` elimina un tag manual

---

## API necesaria

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login con password |
| GET | `/api/v1/auth/me` | Verificar sesión activa |
| POST | `/api/v1/auth/logout` | Cerrar sesión |
| GET | `/api/v1/tags` | Listado de tags con conteo |
| GET | `/api/v1/tags/{tagName}/photos` | Fotos por tag |
| GET | `/api/v1/photos` | Búsqueda/filtrado de fotos |
| POST | `/api/v1/ai/search` | Búsqueda semántica |
| POST | `/api/v1/photos/{id}/favorite` | Toggle favorito |
| POST | `/api/v1/scan` | Disparar escaneo |
| GET | `/api/v1/status` | Estado unificado de operaciones |
| POST | `/api/v1/photos/{id}/classify` | Clasificar foto con IA |
| POST | `/api/v1/photos/{id}/tags` | Añadir tags manuales |
| DELETE | `/api/v1/photos/{id}/tags/{tagName}` | Eliminar tag |

## Ruta y navegación

```
src/app/api/v1/
├── auth/
│   ├── login/route.ts
│   ├── me/route.ts
│   └── logout/route.ts
├── tags/
│   ├── route.ts                     (GET /api/v1/tags)
│   └── [tagName]/
│       └── photos/route.ts
├── photos/
│   └── route.ts                     (GET /api/v1/photos con filtros)
├── ai/
│   └── search/route.ts
├── scan/route.ts
└── status/route.ts
```

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/v1/auth/login/route.ts` | Nuevo — login para iOS (reutiliza lógica de session.ts) |
| `src/app/api/v1/auth/me/route.ts` | Nuevo — verificar sesión |
| `src/app/api/v1/auth/logout/route.ts` | Nuevo — logout |
| `src/app/api/v1/tags/route.ts` | Nuevo — tags con conteo |
| `src/app/api/v1/tags/[tagName]/photos/route.ts` | Nuevo — fotos por tag paginadas |
| `src/app/api/v1/photos/route.ts` | Nuevo — búsqueda/filtrado con cursor |
| `src/app/api/v1/ai/search/route.ts` | Nuevo — búsqueda semántica con formato v1 |
| `src/app/api/v1/scan/route.ts` | Nuevo — disparar y monitorizar scan |
| `src/app/api/v1/status/route.ts` | Nuevo — estado unificado |
| `src/app/api/v1/photos/[id]/classify/route.ts` | Nuevo — clasificar foto |
| `src/app/api/v1/photos/[id]/tags/route.ts` | Nuevo — gestión de tags |
| `src/lib/queries/tags.ts` | Ampliar con `listWithCount(catalogId?)` |

---

## Notas técnicas

- `GET /api/v1/auth/me` es el "ping de sesión" que iOS llama al arrancar para saber si la cookie guardada en `HTTPCookieStorage` sigue siendo válida. Si devuelve 401, la app muestra la pantalla de login.
- El endpoint `/api/v1/status` lee de los mismos estados en memoria que los endpoints separados actuales. Cuando EPIC-001 introduzca estado en DB (jobs table), este endpoint leerá de ahí.
- `POST /api/v1/photos/{id}/favorite` es un toggle (no diferencia PUT/DELETE) para simplificar el cliente iOS que solo necesita "cambiar el estado".
- `POST /api/v1/ai/search` es un POST (no GET) porque el body del query puede ser largo y porque tiene efectos de caché distintos. El resultado no debe cachearse agresivamente.
- La búsqueda semántica puede tardar 5-30 segundos si Ollama está procesando. iOS debe mostrar un indicador de carga y el endpoint no debe tener un timeout inferior a 60s en el servidor.
- Para `DELETE /api/v1/photos/{id}/tags/{tagName}`, el `tagName` en la URL debe ser URL-decoded antes de buscarlo en la DB (`decodeURIComponent`).

---

## Fuera de alcance (v1)

- Edición de metadatos de la foto (título, descripción)
- Endpoint de proyectos (generación y listado) — puede añadirse en v1.1
- WebSocket para progreso de scan en tiempo real (el polling de `/api/v1/status` es suficiente)
- Upload de fotos desde iOS a la biblioteca (requiere arquitectura diferente)
- Compartir fotos o exportar a Photos.app de iOS
