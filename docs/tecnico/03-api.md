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
| `GET` | `/api/photos/ids` | Lista de IDs de fotos (para selección masiva) |
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

## Búsqueda

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/search` | Búsqueda unificada `?q=<texto>&mode=quick\|deep&year=N` — devuelve fotos, tags y eventos |
| `GET` | `/api/search/hints` | Hints para el clasificador: `{ tags: string[], events: string[] }` — se carga una vez al montar el header |
| `GET` | `/api/search/suggestions` | Sugerencias de autocompletado `?q=<texto>` — tags y eventos que coinciden |

### Modo de búsqueda

El parámetro `mode` controla el tipo de búsqueda ejecutada:

| `mode` | Descripción |
|---|---|
| `quick` | Búsqueda por texto en nombre de archivo, evento y tags — sin Ollama |
| `deep` | Análisis visual con Ollama (lento, foto a foto) |

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
| `POST` | `/api/ai/search` | Búsqueda visual profunda `{ query, mode: 'quick'\|'deep', year? }` |
| `GET` | `/api/ollama/status` | Estado de conexión con Ollama |

## Análisis de estilo (Insights)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/insights` | Narrativa del perfil fotográfico actual |
| `GET` | `/api/insights/years` | Lista de años con síntesis disponible |
| `GET` | `/api/insights/evolution` | Datos de evolución (últimos 24 meses) |
| `POST` | `/api/insights/evolution/analyze` | Forzar re-análisis de la evolución reciente |

## Álbumes inteligentes

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/smart-albums` | Lista de álbumes inteligentes del catálogo activo |
| `POST` | `/api/smart-albums` | Crear álbum `{ name, rules[] }` |
| `GET` | `/api/smart-albums/[id]` | Detalle de un álbum |
| `PATCH` | `/api/smart-albums/[id]` | Actualizar nombre o reglas |
| `DELETE` | `/api/smart-albums/[id]` | Eliminar álbum |
| `GET` | `/api/smart-albums/[id]/photos` | Fotos del álbum (evaluación de reglas en tiempo real) |
| `POST` | `/api/smart-albums/preview` | Vista previa de resultados con reglas sin guardar |

## Memorias

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/memories` | Fotos de "on this day" en años anteriores |
| `GET` | `/api/memories/narrative` | Narrativa generada por IA para las memorias del día |

## Compartir

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/share` | Crear enlace compartido `{ photoIds[], expiresInHours? }` |
| `GET` | `/api/share/[token]` | Acceder a fotos compartidas sin login (token público) |

## Backup

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/backup` | Crear backup manual de la base de datos |
| `GET` | `/api/backup` | Lista de backups disponibles |
| `GET` | `/api/backup/status` | Estado del último backup y próxima ejecución |
| `GET` | `/api/backup/config` | Configuración del backup automático |

## Integridad

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/integrity/scan` | Iniciar escaneo de integridad de la biblioteca |
| `GET` | `/api/integrity/status` | Estado del escaneo en curso |
| `GET` | `/api/integrity/report` | Informe de problemas detectados |
| `POST` | `/api/integrity/resolve` | Resolver un problema de integridad `{ action, photoId }` |

## Salud

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del sistema (BD, Ollama, disco) |
| `GET` | `/api/health/history` | Historial de métricas de salud |

## Jobs (worker en background)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/jobs` | Lista de jobs activos y recientes |
| `GET` | `/api/jobs/[id]` | Detalle y progreso de un job específico |

## Estadísticas técnicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/stats/technical` | Métricas técnicas: tamaño de BD, número de thumbnails, etc. |

## Catálogos — organización IA

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/catalogs/[id]/analyze-structure` | Análisis de la estructura de carpetas del catálogo |
| `GET` | `/api/catalogs/[id]/suggest-albums` | Sugerencias de álbumes inteligentes basadas en el catálogo |
| `POST` | `/api/catalogs/[id]/auto-organize` | Aplicar una organización automática sugerida |

## Amplitude (analytics)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/amplitude/sync` | Sincronizar metadatos EXIF del catálogo a Amplitude |

---

## API v1 (cliente iOS)

Prefijo `/api/v1/`. Misma autenticación por cookie. Respuestas con envelope `{ data, meta? }`.

Ver [docs/api-v1.md](../api-v1.md) para referencia completa.

Endpoints disponibles:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/photos` | Lista paginada (offset) con filtros |
| `GET` | `/api/v1/photos/[id]` | Detalle con tags y temáticas |
| `GET` | `/api/v1/photos/[id]/thumbnail` | Miniatura WebP |
| `GET` | `/api/v1/photos/[id]/original` | Archivo original |
| `GET` | `/api/v1/photos/[id]/adjacent` | IDs de foto anterior y siguiente en el evento |
| `GET` | `/api/v1/timeline` | Timeline con cursor-based pagination |
| `GET` | `/api/v1/timeline/[periodKey]/photos` | Fotos de un período concreto |
| `GET` | `/api/v1/tags` | Tags del catálogo activo con conteo |
| `GET` | `/api/v1/catalogs` | Lista de catálogos con catálogo activo |
| `POST` | `/api/v1/catalogs/switch` | Cambiar catálogo activo |

## Formato de respuesta de paginación (Timeline web)

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
