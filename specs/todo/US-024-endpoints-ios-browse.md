# Feature: Endpoints iOS — timeline, detalle de foto y thumbnails

## Historia de usuario

Como app nativa iOS de photoshelf,
quiero endpoints que devuelvan el timeline paginado, el detalle completo de una foto y sus imágenes,
para implementar las vistas de browsing principales sin lógica de transformación en el cliente.

---

## Descripción

Las tres vistas más usadas en una galería de fotos son: el timeline (vista de cuadrícula agrupada por fecha), el detalle de una foto (metadatos completos + imagen), y la navegación anterior/siguiente. Los endpoints actuales de photoshelf cubren estos casos para la web, pero con contratos que no están pensados para un cliente iOS: el timeline devuelve todas las agrupaciones de golpe, el detalle de foto está distribuido entre varias rutas sin un endpoint unificado, y la paginación no es consistente.

Esta US crea o revisa los endpoints bajo `/api/v1/` necesarios para implementar la pantalla de timeline y de detalle de foto de una app iOS, siguiendo los contratos definidos en US-023.

---

## Criterios de aceptación

### `GET /api/v1/timeline`
- [ ] Devuelve los periodos del timeline (año, mes, día según `zoom`) paginados
- [ ] Parámetros: `?zoom=1|2|3|4|5&limit=50&cursor=<cursor>&catalogId=1`
- [ ] Respuesta:
  ```json
  {
    "data": [
      {
        "periodKey": "2024-08",
        "label": "Agosto 2024",
        "count": 142,
        "thumbnail": { "photoId": 1234, "url": "/api/v1/photos/1234/thumbnail?size=200" }
      }
    ],
    "meta": { "total": 38, "hasMore": true, "nextCursor": "MjAyNC0wNg==" }
  }
  ```
- [ ] El cursor es el `periodKey` del último periodo devuelto, encoded en base64
- [ ] El campo `thumbnail.url` es absoluto solo si se necesita (relativo es suficiente para iOS que conoce el base URL)

### `GET /api/v1/timeline/{periodKey}/photos`
- [ ] Devuelve las fotos de un periodo concreto (ej. `2024-08`) paginadas
- [ ] Parámetros: `?limit=50&cursor=<cursor>&catalogId=1`
- [ ] Respuesta incluye array de fotos con `id`, `filename`, `taken_at`, `thumbnail_url`, `gps_lat?`, `gps_lon?`
- [ ] El cursor es el `taken_at + id` del último foto vista

### `GET /api/v1/photos/{id}`
- [ ] Devuelve el detalle completo de una foto:
  ```json
  {
    "data": {
      "id": 1234,
      "filename": "IMG_20240815_143200.jpg",
      "path": "2024/Vacaciones/IMG_20240815_143200.jpg",
      "taken_at": "2024-08-15T14:32:00Z",
      "year": 2024,
      "event": "Vacaciones",
      "width": 4032,
      "height": 3024,
      "size_bytes": 4821233,
      "gps_lat": 41.3879,
      "gps_lon": 2.1699,
      "is_favorite": false,
      "catalog_id": 1,
      "tags": [
        { "name": "personas", "source": "ai" },
        { "name": "verano", "source": "manual" }
      ],
      "themes": [
        { "id": 3, "name": "Familia" }
      ],
      "thumbnail_url": "/api/v1/photos/1234/thumbnail",
      "original_url": "/api/v1/photos/1234/original"
    }
  }
  ```
- [ ] Si la foto no existe → 404 con `ApiError { code: "NOT_FOUND" }`

### `GET /api/v1/photos/{id}/thumbnail`
- [ ] Equivalente al endpoint existente, bajo el nuevo prefijo
- [ ] Parámetro `?size=120|200|400|800` (default: 400)
- [ ] Devuelve la imagen en WebP con el `Content-Type` correcto
- [ ] Incluye `Cache-Control: public, max-age=31536000, immutable` (las thumbnails no cambian)

### `GET /api/v1/photos/{id}/original`
- [ ] Equivalente al endpoint existente, bajo el nuevo prefijo
- [ ] Incluye `Content-Disposition: attachment; filename="..."` para descarga en iOS
- [ ] `Content-Type` correcto según la extensión del archivo

### Navegación anterior/siguiente
- [ ] `GET /api/v1/photos/{id}/adjacent?context=<contextType>&contextValue=<value>` devuelve `{ prev: { id, thumbnail_url } | null, next: { id, thumbnail_url } | null }`
- [ ] `contextType` puede ser: `timeline` (orden cronológico), `tag` (dentro de un tag), `event` (dentro de un evento)
- [ ] La web puede seguir usando su mecanismo actual; este endpoint es para iOS

---

## API necesaria

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/timeline` | Periodos del timeline paginados |
| GET | `/api/v1/timeline/{periodKey}/photos` | Fotos de un periodo |
| GET | `/api/v1/photos/{id}` | Detalle completo de foto |
| GET | `/api/v1/photos/{id}/thumbnail` | Thumbnail de la foto |
| GET | `/api/v1/photos/{id}/original` | Imagen original |
| GET | `/api/v1/photos/{id}/adjacent` | Fotos anterior y siguiente |

## Ruta y navegación

Todos los endpoints bajo `src/app/api/v1/`:
```
src/app/api/v1/
├── timeline/
│   ├── route.ts                    (GET /api/v1/timeline)
│   └── [periodKey]/
│       └── photos/route.ts         (GET /api/v1/timeline/{periodKey}/photos)
└── photos/
    └── [id]/
        ├── route.ts                (GET /api/v1/photos/{id})
        ├── thumbnail/route.ts
        ├── original/route.ts
        └── adjacent/route.ts
```

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/v1/timeline/route.ts` | Nuevo — timeline paginado |
| `src/app/api/v1/timeline/[periodKey]/photos/route.ts` | Nuevo — fotos de un periodo |
| `src/app/api/v1/photos/[id]/route.ts` | Nuevo — detalle completo de foto |
| `src/app/api/v1/photos/[id]/thumbnail/route.ts` | Nuevo — sirve thumbnail (reutiliza lógica de thumbnail.ts) |
| `src/app/api/v1/photos/[id]/original/route.ts` | Nuevo — sirve original (reutiliza lógica existente) |
| `src/app/api/v1/photos/[id]/adjacent/route.ts` | Nuevo — navegación contextual |
| `src/lib/queries/timeline.ts` | Ampliar con soporte de cursor y catalogId |
| `src/lib/queries/photos.ts` | Ampliar con `getAdjacent(id, context, contextValue)` |

---

## Notas técnicas

- Para el cursor del timeline, encoded en base64 del `periodKey` (ej. `"2024-08"` → `"MjAyNC0w"`). El servidor lo decodifica y hace `WHERE period_key < ?` (orden DESC) o `WHERE period_key > ?` (orden ASC).
- El campo `taken_at` en la respuesta debe ser ISO 8601 con timezone UTC (importante para iOS `Date` parsing).
- `thumbnail_url` puede ser relativo (`/api/v1/photos/1234/thumbnail`) — la app iOS concatena con el base URL configurado.
- Para `GET /api/v1/photos/{id}` la query usa `timelineQueries` y `tagQueries` del repositorio (US-022) — no SQL inline.
- El endpoint `/adjacent` necesita saber el contexto de navegación porque "siguiente foto" depende de si el usuario está en el timeline general, dentro de un tag, o dentro de un evento.
- Los headers `Cache-Control` en thumbnails permiten que iOS cachee las imágenes sin volver a pedirlas en cada apertura.

---

## Fuera de alcance (v1)

- Endpoint de búsqueda semántica en este scope (cubierto en US-025)
- Streaming de fotos (para vídeos o RAWs grandes)
- Endpoint de listado plano de fotos sin agrupar por timeline (puede añadirse en v2)
- Soporte para Live Photos de iOS
