# Feature: Endpoints iOS — timeline, detalle de foto y thumbnails

> Estado: ✅ Desplegada

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
- [x] Devuelve los periodos del timeline (año, mes, día según `zoom`) paginados
- [x] Parámetros: `?zoom=1|2|3|4|5&limit=50&cursor=<cursor>`
- [x] El cursor es el `periodKey` del último periodo devuelto, encoded en base64url
- [x] Cada periodo incluye `periodKey`, `label`, `count`, `thumbnail.photoId`, `thumbnail.url`

### `GET /api/v1/timeline/{periodKey}/photos`
- [x] Devuelve las fotos de un periodo concreto (ej. `2024-08`) paginadas
- [x] Parámetros: `?limit=50&cursor=<cursor>`
- [x] Respuesta incluye `id`, `filename`, `taken_at`, `thumbnail_url`, `gps_lat?`, `gps_lon?`
- [x] Cursor es `taken_at|id` encoded en base64url

### `GET /api/v1/photos/{id}`
- [x] Devuelve el detalle completo de una foto con `thumbnail_url` y `original_url`
- [x] Si la foto no existe → 404 con `ApiError { code: "NOT_FOUND" }`

### `GET /api/v1/photos/{id}/thumbnail`
- [x] Parámetro `?size=120|200|400|800` (default: 400)
- [x] Devuelve la imagen con `Content-Type` correcto
- [x] Incluye `Cache-Control: public, max-age=31536000, immutable`

### `GET /api/v1/photos/{id}/original`
- [x] Incluye `Content-Disposition: attachment; filename="..."` para descarga en iOS
- [x] `Content-Type` correcto según la extensión del archivo

### Navegación anterior/siguiente
- [x] `GET /api/v1/photos/{id}/adjacent?context=timeline|event|tag[&contextValue=<value>]`
- [x] Devuelve `{ prev: { id, thumbnail_url } | null, next: { id, thumbnail_url } | null }`

---

## API implementada

| Método | Ruta | Fichero |
|--------|------|---------|
| GET | `/api/v1/timeline` | `src/app/api/v1/timeline/route.ts` |
| GET | `/api/v1/timeline/{periodKey}/photos` | `src/app/api/v1/timeline/[periodKey]/photos/route.ts` |
| GET | `/api/v1/photos/{id}` | `src/app/api/v1/photos/[id]/route.ts` |
| GET | `/api/v1/photos/{id}/thumbnail` | `src/app/api/v1/photos/[id]/thumbnail/route.ts` |
| GET | `/api/v1/photos/{id}/original` | `src/app/api/v1/photos/[id]/original/route.ts` |
| GET | `/api/v1/photos/{id}/adjacent` | `src/app/api/v1/photos/[id]/adjacent/route.ts` |
