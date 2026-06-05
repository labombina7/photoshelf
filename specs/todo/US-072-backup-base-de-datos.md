# US-072 — Backup de la base de datos desde la app

## Resumen

El usuario puede lanzar un backup de `photoshelf.db` directamente desde la sección de gestión de catálogos, tanto de forma manual como programada cada X días. El backup genera un archivo `.db` comprimido y un JSON de tags/proyectos como seguro adicional.

---

## Problema

La base de datos contiene trabajo irrecuperable: tags AI generados con horas de cómputo, tags manuales, favoritos marcados y álbumes curados. Actualmente no hay mecanismo en la app para protegerla. Un borrado accidental del volumen o una migración de NAS obliga a re-escanear y re-etiquetar todo desde cero.

---

## Comportamiento esperado

### Panel de backup en gestión de catálogos

En la página de gestión de catálogos (`/catalogs` o sección equivalente) aparece un nuevo bloque **"Backup de base de datos"** con:

1. **Botón "Crear backup ahora"** — lanza el backup de forma inmediata. Muestra spinner mientras corre y, al terminar, indica la ruta y el tamaño del archivo generado.

2. **Toggle "Backup automático"** — activa/desactiva la ejecución recurrente.
   - Cuando está activado aparece un selector de frecuencia: **cada X días** (valores: 1, 3, 7, 14, 30 — default: 7).
   - El estado (activo/inactivo + frecuencia seleccionada) se persiste en la BD.
   - Un job en background comprueba al arrancar la app si toca ejecutar backup y lo lanza si `ahora - último_backup >= X días`.

3. **Último backup**: fecha/hora y ruta del backup más reciente, o "Nunca" si no se ha hecho ninguno.

---

## Qué genera el backup

Cada ejecución crea dos archivos en `BACKUP_PATH` (configurable via env, default: `DATA_PATH/backups/`):

| Archivo | Descripción |
|---|---|
| `photoshelf-YYYYMMDD-HHMMSS.db` | Copia atómica del DB con `VACUUM INTO` — es un SQLite válido, restaurable directamente |
| `photoshelf-YYYYMMDD-HHMMSS-tags.json` | Export JSON de `photo_tags` + `photo_themes` + `projects` + `project_photos` + favoritos — texto legible, útil si el `.db` se corrompe |

Se conservan los **últimos 10 backups** (por fecha de creación). Los más antiguos se borran automáticamente al crear uno nuevo.

---

## API

### `POST /api/backup` — lanza backup inmediato

Request: vacío.

Response `200`:
```json
{
  "db_path": "/data/backups/photoshelf-20260605-143022.db",
  "json_path": "/data/backups/photoshelf-20260605-143022-tags.json",
  "db_size_bytes": 2048000,
  "duration_ms": 340
}
```

Response `500`: `{ "error": "mensaje del error" }`

### `GET /api/backup/status` — estado del backup

Response `200`:
```json
{
  "last_backup_at": "2026-06-05T14:30:22Z",
  "last_backup_db_path": "/data/backups/photoshelf-20260605-143022.db",
  "auto_enabled": true,
  "auto_interval_days": 7,
  "next_backup_at": "2026-06-12T14:30:22Z"
}
```

### `PUT /api/backup/config` — actualiza configuración de backup automático

Request:
```json
{
  "auto_enabled": true,
  "auto_interval_days": 7
}
```

Response `200`: misma forma que `GET /api/backup/status`.

---

## Persistencia de configuración

Se añade una tabla `backup_config` en la BD:

```sql
CREATE TABLE backup_config (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton
  auto_enabled        INTEGER NOT NULL DEFAULT 0,
  auto_interval_days  INTEGER NOT NULL DEFAULT 7,
  last_backup_at      TEXT,
  last_backup_db_path TEXT
);
```

La migración añade la fila `id=1` al arrancar si no existe (mismo patrón que el catálogo por defecto).

---

## Lógica del job automático

- Al arrancar la app (`getDb()` o equivalente), se comprueba si `auto_enabled = 1` y si `now - last_backup_at >= auto_interval_days`.
- Si toca, se encola el backup como job en la cola de jobs existente (US-071) con tipo `backup`.
- No bloquea el arranque — corre en background.
- Si el directorio de destino no existe, se crea automáticamente.

---

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `BACKUP_PATH` | `$DATA_PATH/backups` o `./data/backups` | Directorio donde se guardan los backups |

Se documenta en `.env.example`.

---

## UI — detalle del bloque

```
┌─ Backup de base de datos ─────────────────────────────────────────┐
│                                                                     │
│  Último backup: 05 jun 2026, 14:30  ·  /data/backups/photo….db    │
│                                                                     │
│  [  Crear backup ahora  ]                                           │
│                                                                     │
│  ○ Backup automático  ●                                             │
│    Cada  [ 7 ▾ ]  días                                             │
│    Próximo: 12 jun 2026                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

- El botón "Crear backup ahora" se desactiva mientras corre el backup (con spinner).
- Si hay un backup en curso (job activo), el botón aparece desactivado con texto "Backup en curso…".
- Los errores se muestran inline bajo el botón, en rojo, con el mensaje del error.

---

## Criterios de aceptación

- [ ] `POST /api/backup` genera los dos archivos en `BACKUP_PATH` y responde con las rutas y tamaños.
- [ ] `VACUUM INTO` se usa para el `.db` (backup atómico, no copia de archivo en caliente).
- [ ] El JSON contiene todas las filas de `photo_tags`, `photo_themes`, `projects`, `project_photos`, y `photos.is_favorite = 1`.
- [ ] Se conservan máximo 10 backups; los más antiguos se eliminan al crear uno nuevo.
- [ ] El bloque de backup aparece en la UI de gestión de catálogos.
- [ ] El toggle y el selector de frecuencia persisten entre reinicios.
- [ ] Al arrancar la app, si `auto_enabled` y han pasado X días, se encola el backup automáticamente.
- [ ] `BACKUP_PATH` es configurable via env y se documenta en `.env.example`.
- [ ] Si `BACKUP_PATH` no existe, se crea al primer backup.
