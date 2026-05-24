# API Reference

Todos los endpoints requieren sesión activa (cookie `iron-session`). Las respuestas son JSON salvo los endpoints de media (thumbnail, original).

## Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | `{ password }` → establece sesión |
| `POST` | `/api/auth/logout` | Destruye la sesión |

## Catálogos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/catalogs` | Lista de catálogos con conteo de fotos |
| `POST` | `/api/catalogs` | Crear catálogo `{ name, path, isDefault? }` |
| `PATCH` | `/api/catalogs/[id]` | Actualizar nombre o path |
| `DELETE` | `/api/catalogs/[id]` | Eliminar catálogo (y sus fotos de la BD) |
| `POST` | `/api/catalogs/switch` | Cambiar catálogo activo `{ catalogId }` |

## Fotos

Todas las rutas de fotos operan sobre el catálogo activo (resuelto desde la sesión).

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/photos` | Lista de fotos con filtros (`year`, `event`, `theme`, `favorite`, `untagged`, `tag`, `search`, `cursor`, `limit`) |
| `GET` | `/api/photos/[id]` | Detalle de una foto (metadatos + tags + temáticas) |
| `PATCH` | `/api/photos/[id]` | Actualizar (`is_favorite`) |
| `GET` | `/api/photos/[id]/thumbnail` | Miniatura WebP (`?size=N`, default 200) |
| `GET` | `/api/photos/[id]/original` | Archivo original (stream) |
| `GET` | `/api/photos/groups` | Grupos de eventos (`year`, `event`, `count`, `cover_id`) |
| `GET` | `/api/photos/map` | Fotos con GPS para el mapa (`?year=N` filtro opcional) |

## Tags

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tags` | Todos los tags con conteo |
| `GET` | `/api/tags/[photoId]` | Tags de una foto |
| `POST` | `/api/tags/[photoId]` | Añadir tag `{ name }` |
| `DELETE` | `/api/tags/[photoId]` | Eliminar tag `{ name }` |

## Temáticas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/themes` | Lista de temáticas con conteo |
| `POST` | `/api/themes` | Crear temática `{ name, color }` |
| `PATCH` | `/api/themes/[id]` | Actualizar `{ name?, color? }` |
| `DELETE` | `/api/themes/[id]` | Eliminar temática |
| `GET` | `/api/photo-themes/[photoId]` | Temáticas de una foto |
| `POST` | `/api/photo-themes/[photoId]` | Asignar `{ themeId }` |
| `DELETE` | `/api/photo-themes/[photoId]` | Desasignar `{ themeId }` |

## Timeline

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/timeline` | Fotos paginadas por cursor (`level`, `cursor`, `limit`) |

## Proyectos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/projects` | Lista de proyectos |
| `POST` | `/api/projects` | Crear proyecto |
| `GET` | `/api/projects/[id]` | Detalle de proyecto con fotos |
| `PATCH` | `/api/projects/[id]` | Actualizar proyecto o fotos |
| `DELETE` | `/api/projects/[id]` | Eliminar proyecto |
| `POST` | `/api/projects/generate` | Generar proyecto con IA `{ scopeType, scopeValue, count, filters? }` |

## Escaneo

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/scan` | Iniciar escaneo del catálogo activo |
| `GET` | `/api/scan/status` | Estado del escaneo `{ running, done, total, currentEvent, error }` |

## Vigilante de carpetas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/watcher/status` | Estado del vigilante `{ enabled, watching, classifying, classifyDone, classifyTotal, lastScanAt, reason }` |
| `POST` | `/api/watcher/toggle` | Activar/desactivar `{ enabled: boolean }` |

## IA (Ollama)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/ai/classify/[photoId]` | Clasificar una foto con IA |
| `POST` | `/api/ai/classify/batch` | Clasificar en batch `{ year?, limit? }` |
| `GET` | `/api/ai/classify/status` | Estado de la clasificación en curso |
| `POST` | `/api/ai/classify/year` | Clasificar todas las fotos de un año |
| `GET` | `/api/ai/review/[photoId]` | Obtener review de IA (composición, luz, puntuación) |
| `POST` | `/api/ai/search` | Búsqueda semántica `{ query, mode: 'quick'\|'deep', year? }` |
| `GET` | `/api/ollama/status` | Estado de conexión con Ollama |

## Formato de respuesta de paginación (Timeline)

```json
{
  "groups": [
    {
      "period": "2024-05",
      "label": "mayo 2024",
      "count": 47,
      "photos": [
        { "id": 1, "filename": "DSC_0001.jpg", "taken_at": "2024-05-14T10:23:00" }
      ]
    }
  ],
  "nextCursor": "2024-05-14T10:23:00",
  "hasMore": true
}
```

> **Nota:** US-023 (pendiente) estandarizará todas las respuestas con un envelope `{ data, error, meta }` y prefijo `/api/v1/` para el cliente iOS.
