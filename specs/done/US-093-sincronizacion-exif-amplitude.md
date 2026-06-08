> Estado: ✅ Desplegada (PR #167, 2026-06-07)

# US-093 — Sincronización de metadatos EXIF a Amplitude

## Historia de usuario

Como fotógrafo que usa photoshelf,
quiero que los metadatos EXIF de mi catálogo se envíen a Amplitude,
para poder analizar mi estilo fotográfico con las gráficas y herramientas nativas de Amplitude (breakdowns por cámara, focal, ISO, género, tendencias temporales, etc.).

---

## Descripción

Amplitude recibe cada foto como un evento `photo_taken` con propiedades técnicas extraídas del EXIF. La fecha del evento es `taken_at`, por lo que el histórico aparece correctamente en la línea de tiempo de Amplitude.

La sincronización es:
- **Inicial**: carga masiva de todas las fotos existentes (en batches de 100)
- **Incremental**: cuando entran fotos nuevas vía el watcher/scanner, se sincronizan automáticamente

Los datos de GPS **no se envían** por privacidad. El resto del EXIF (cámara, focal, apertura, ISO, fecha, género, tags) es inocuo.

Con esto el usuario puede construir en Amplitude charts como:
- Distribución de cámaras usadas por año
- Evolución del focal length medio
- Histograma de apertura / ISO
- Géneros fotográficos más frecuentes
- Hora del día preferida para disparar
- Volumen de fotos por mes

---

## Criterios de aceptación

### Configuración

- [ ] La API key de Amplitude se configura vía variable de entorno `AMPLITUDE_API_KEY`
- [ ] Si `AMPLITUDE_API_KEY` no está definida, la sincronización se desactiva silenciosamente (no hay errores)
- [ ] El `user_id` enviado a Amplitude es configurable vía `AMPLITUDE_USER_ID` (por defecto `"photoshelf-user"`)

### Evento

- [ ] Nombre del evento: `photo_taken`
- [ ] El `insert_id` es `photo_${id}` para garantizar idempotencia en re-sincronizaciones
- [ ] El `time` del evento es el timestamp Unix de `taken_at` (en ms)
- [ ] Si `taken_at` es null, se usa `created_at` como fallback

### Propiedades del evento

| Propiedad | Fuente | Notas |
|---|---|---|
| `camera` | `photos.camera` | null si no disponible |
| `focal_length` | `photos.focal_length` | en mm |
| `aperture` | `photos.aperture` | f-number |
| `iso` | `photos.iso` | valor numérico |
| `shutter_speed` | `photos.shutter_speed_seconds` | en segundos |
| `year` | `taken_at` | año del disparo |
| `month` | `taken_at` | mes (1-12) |
| `hour_of_day` | `taken_at` | hora (0-23) |
| `day_of_week` | `taken_at` | 0=domingo…6=sábado |
| `genre` | `ai_tags` (top genre) | primera etiqueta de género IA |
| `tags` | `ai_tags` | array de strings, máx 10 |
| `width` | `photos.width` | píxeles |
| `height` | `photos.height` | píxeles |
| `has_exif` | calculado | bool: tiene al menos focal/apertura/iso |

**No se envían**: `gps_lat`, `gps_lon`, `path`, `filename` (privacidad / datos sensibles).

### Sincronización inicial

- [ ] Endpoint `POST /api/amplitude/sync` que lanza la sincronización en background
- [ ] Procesa en batches de 100 fotos (límite de la API HTTP v2 de Amplitude)
- [ ] Marca cada foto como sincronizada en una nueva columna `amplitude_synced_at` de la tabla `photos`
- [ ] Solo envía fotos con `amplitude_synced_at IS NULL`
- [ ] Responde inmediatamente con `{ started: true, pending: N }` y procesa en background
- [ ] Endpoint `GET /api/amplitude/sync` devuelve el progreso actual `{ total, synced, percent }`

### Sincronización incremental

- [ ] Cuando el scanner/watcher añade fotos nuevas, se encolan para sincronización automática
- [ ] El worker llama a `syncPendingPhotosToAmplitude()` cada vez que termina un scan

### UI

- [ ] En la página de Herramientas (`/jobs`) hay una tarjeta "Amplitude" que muestra:
  - Estado de la API key (configurada / no configurada)
  - Progreso de sincronización (`N de M fotos sincronizadas`)
  - Botón "Sincronizar ahora" que llama al endpoint POST
- [ ] Si la API key no está configurada, la tarjeta muestra instrucciones para configurarla

---

## API

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `POST /api/amplitude/sync` | POST | Sí | Lanza sincronización inicial en background |
| `GET /api/amplitude/sync` | GET | Sí | Devuelve progreso de sincronización |

---

## Esquema de BD

```sql
-- Migración: añadir columna a photos
ALTER TABLE photos ADD COLUMN amplitude_synced_at TEXT;
CREATE INDEX idx_photos_amplitude ON photos(amplitude_synced_at) WHERE amplitude_synced_at IS NULL;
```

---

## Archivos nuevos / modificados

| Archivo | Descripción |
|---|---|
| `src/lib/amplitude.ts` | Cliente HTTP v2 de Amplitude: `sendEvents(events[])`, `buildPhotoEvent(photo)` |
| `src/lib/queries/amplitude.ts` | `getUnsyncedPhotos(limit)`, `markPhotosAsSynced(ids[])` |
| `src/app/api/amplitude/sync/route.ts` | GET (progreso) + POST (lanzar sync) |
| `src/lib/worker.ts` | Llamar `syncPendingPhotosToAmplitude()` tras cada scan |
| `src/app/jobs/JobsClient.tsx` | Tarjeta Amplitude en la UI de herramientas |
| `src/lib/db.ts` | Migración: columna `amplitude_synced_at` + índice |

---

## Notas técnicas

### Amplitude HTTP API v2

```
POST https://api2.amplitude.com/2/httpapi
Content-Type: application/json

{
  "api_key": "...",
  "events": [
    {
      "user_id": "photoshelf-user",
      "insert_id": "photo_123",
      "event_type": "photo_taken",
      "time": 1680000000000,
      "event_properties": { ... }
    }
  ]
}
```

Límite: 100 eventos por request, 10MB máximo por request.

### Idempotencia

El `insert_id: photo_${id}` garantiza que si se re-sincroniza una foto ya enviada, Amplitude la descarta silenciosamente (deduplicación nativa). Esto permite re-lanzar la sync sin duplicar datos.

---

## Fuera de alcance (v1)

- Sincronización de álbumes, proyectos o smart albums como propiedades de usuario
- Envío de eventos de comportamiento del usuario en la app (clicks, vistas)
- Dashboard predefinido en Amplitude (se crea manualmente tras la primera sync)
- Soporte para múltiples usuarios / catálogos en el mismo proyecto Amplitude

## Ideas para v2

- **Embeber charts de Amplitude en la app**: Amplitude permite compartir dashboards con iframe. Una vez configurado y con datos, evaluar qué charts merece la pena incrustar en la sección "Tu estilo" o en una nueva sección de analytics. El iframe se configuraría con la URL pública del chart compartido desde Amplitude.
