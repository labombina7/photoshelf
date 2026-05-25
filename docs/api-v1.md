# Photoshelf API v1

Base URL: `http://<nas-ip>:<port>/api/v1`

---

## Contrato de respuesta

Todas las respuestas de éxito tienen el envelope:

```json
{ "data": <payload>, "meta": { ... } }
```

Los errores devuelven siempre:

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE", "status": 401 }
```

Códigos de error:

| code | status | descripción |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Sin sesión activa |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `BAD_REQUEST` | 400 | Parámetros inválidos |
| `INTERNAL_ERROR` | 500 | Error de servidor |

---

## Autenticación

La API usa cookies de sesión (iron-session). Flujo desde iOS:

**1. Login**

```
POST /api/auth/login
Content-Type: application/json

{ "password": "tu-contraseña" }
```

Respuesta `200 OK`:
```json
{ "ok": true }
```

El servidor devuelve `Set-Cookie: photoshelf_session=<token>; HttpOnly; SameSite=Lax`.  
`URLSession` de iOS almacena y envía esta cookie automáticamente en peticiones al mismo host.

**2. Logout**

```
POST /api/auth/logout
```

**Nota**: Las rutas `/api/v1/*` devuelven `401 UNAUTHORIZED` si no hay cookie de sesión válida.

---

## Paginación

Los endpoints de lista aceptan:

| parámetro | tipo | defecto | máx |
|-----------|------|---------|-----|
| `limit`   | int  | 50      | 200 |
| `offset`  | int  | 0       | —   |

La respuesta `meta` incluye:

```json
{
  "total": 1240,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

El endpoint `/api/v1/timeline` usa cursor-based pagination:

| parámetro | tipo   | descripción |
|-----------|--------|-------------|
| `cursor`  | string | Valor opaco devuelto en `meta.nextCursor` de la respuesta anterior |
| `limit`   | int    | 1–120, defecto 60 |

---

## Endpoints

### Fotos

#### `GET /api/v1/photos`

Lista fotos del catálogo activo con paginación.

**Query params**: `limit`, `offset`, `year`, `event`, `tag`, `theme`, `favorite=1`, `untagged=1`, `q=<texto>`

**Respuesta:**
```json
{
  "data": [
    {
      "id": 42,
      "filename": "IMG_0042.jpg",
      "year": 2023,
      "event": "Verano en la playa",
      "taken_at": "2023-08-15T10:30:00.000Z",
      "camera": "Apple iPhone 14 Pro",
      "exposure": "1/1000 · f/1.78 · ISO 50",
      "gps_lat": 40.4168,
      "gps_lon": -3.7038,
      "is_favorite": 0,
      "catalog_id": 1
    }
  ],
  "meta": { "total": 1240, "limit": 50, "offset": 0, "hasMore": true }
}
```

#### `GET /api/v1/photos/:id`

Detalle de una foto, incluyendo tags y temas.

**Respuesta:**
```json
{
  "data": {
    "id": 42,
    "filename": "IMG_0042.jpg",
    "tags": [{ "id": 3, "name": "verano", "source": "ai" }],
    "themes": [{ "id": 1, "name": "Vacaciones", "color": "#f59e0b" }],
    "...resto de campos de foto"
  }
}
```

---

### Catálogos

#### `GET /api/v1/catalogs`

Lista todos los catálogos e indica cuál está activo en la sesión actual.

**Respuesta:**
```json
{
  "data": {
    "catalogs": [
      { "id": 1, "name": "Principal", "path": "/photos", "photo_count": 1240 },
      { "id": 2, "name": "Archivo 2020", "path": "/archive/2020", "photo_count": 340 }
    ],
    "activeCatalogId": 1
  }
}
```

#### `POST /api/v1/catalogs/switch`

Cambia el catálogo activo para la sesión. Todas las peticiones posteriores devuelven datos de ese catálogo.

**Body:**
```json
{ "catalogId": 2 }
```

**Respuesta:**
```json
{
  "data": { "catalog": { "id": 2, "name": "Archivo 2020", "path": "/archive/2020" } }
}
```

---

### Tags

#### `GET /api/v1/tags`

Lista todos los tags del catálogo activo con su recuento de fotos, ordenados por frecuencia.

**Respuesta:**
```json
{
  "data": [
    { "name": "verano", "count": 87 },
    { "name": "familia", "count": 64 }
  ]
}
```

---

### Timeline

#### `GET /api/v1/timeline`

Fotos ordenadas por fecha descendente con cursor-based pagination.

**Query params**: `limit` (1–120, defecto 60), `cursor` (opaco, de `meta.nextCursor` anterior)

**Respuesta:**
```json
{
  "data": [
    { "id": 42, "filename": "IMG_0042.jpg", "taken_at": "2023-08-15T10:30:00.000Z" }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "2023-08-14T18:22:00.000Z",
    "limit": 60
  }
}
```

Para cargar la siguiente página:
```
GET /api/v1/timeline?cursor=2023-08-14T18%3A22%3A00.000Z&limit=60
```
