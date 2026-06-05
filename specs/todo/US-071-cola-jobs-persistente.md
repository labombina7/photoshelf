# US-071 — Cola de jobs persistente y auto-reanudable

> Estado: 🔵 En refinamiento

## Historia de usuario

Como fotógrafo que lanza clasificaciones largas,
quiero poder encolar trabajos y reanudarlos automáticamente tras un reinicio,
para no perder el progreso ni tener que recordar qué había lanzado.

---

## Contexto y problema real

Actualmente el estado de un job vive en memoria. Si el servidor se reinicia (nuevo deploy, prueba de feature), hay que:

1. Recordar qué estaba clasificando
2. Volver a la pantalla correcta
3. Hacer clic otra vez
4. Esperar desde cero — incluso si ya había procesado 200 de 300 fotos

Con `force=true` el problema es peor: las fotos ya reclasificadas tienen tags nuevos, pero el worker no sabe cuáles fueron procesadas en este run vs en runs anteriores.

---

## Arquitectura

### Tabla `job_queue` (SQLite)

```sql
CREATE TABLE job_queue (
  id          TEXT PRIMARY KEY,  -- uuid
  type        TEXT NOT NULL,     -- 'classify_batch' | 'classify_year' | 'scan'
  payload     TEXT NOT NULL,     -- JSON: { folderId?, year?, force?, catalogId? }
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | completed | failed | cancelled
  started_at  TEXT,              -- ISO8601 — momento en que el worker empezó este run
  processed   INTEGER DEFAULT 0,
  total       INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_last  TEXT,              -- último mensaje de error
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Máquina de estados

```
pending → in_progress → completed
                      → failed
pending → cancelled
in_progress → cancelled  (marca cancelled, el worker lo detecta y para)
```

### Worker singleton (`src/lib/worker.ts`)

Un módulo Node con estado en memoria que se inicializa en el primer request al servidor. Al arrancar:

1. Busca jobs con `status = 'in_progress'` — los retoma
2. Si no hay ninguno, busca `status = 'pending'` ordenado por `created_at` — empieza el más antiguo
3. Procesa el job activo foto a foto, actualizando `processed` en SQLite tras cada foto
4. Al terminar, busca el siguiente `pending` automáticamente

---

## Lógica de reanudación

### Clasificación normal (`force=false`)

Ya funciona: las fotos con `ai_tags` de `source=ai` se saltan. El worker retoma procesando solo las que no tienen tags.

### Reclasificación (`force=true`)

El job guarda `started_at` cuando empieza. Al reanudar:

```sql
-- fotos pendientes: sin tags de este run
SELECT p.id FROM photos p
LEFT JOIN ai_tags t ON t.photo_id = p.id AND t.source = 'ai'
WHERE (t.photo_id IS NULL OR t.created_at < :started_at)
AND p.folder_id = :folderId
```

Los tags insertados en este run tienen `created_at >= started_at` → ya procesados, se saltan.
Los tags anteriores tienen `created_at < started_at` → pendientes.

**Condición necesaria:** al reclasificar se hace `DELETE` + `INSERT` de tags, no `UPDATE`. El `INSERT` en SQLite pone el timestamp actual. Esto ya es el comportamiento actual.

---

## Criterios de aceptación

### Cola persistente

- [ ] Tabla `job_queue` creada en la migración de BD
- [ ] Al hacer clic en "Clasificar carpeta X" se crea un registro `pending` — la UI no espera, devuelve inmediatamente el `job_id`
- [ ] El worker procesa un job a la vez; el siguiente empieza automáticamente al terminar el anterior
- [ ] Se puede encolar un job mientras otro está `in_progress` — queda en `pending` hasta su turno

### Auto-reanudación

- [ ] Al arrancar el servidor, el worker retoma automáticamente cualquier job `in_progress` o `pending`
- [ ] Un job `in_progress` reanudado no reinicia `processed` — continúa desde donde estaba
- [ ] `force=false`: salta fotos con `ai_tags` existentes (comportamiento actual preservado)
- [ ] `force=true`: salta fotos cuyos tags tienen `created_at >= job.started_at`
- [ ] El `started_at` se actualiza en cada reanudación (no conserva el timestamp de la sesión anterior)

### Feedback en el punto de origen

- [ ] El botón que disparó el job (ej. "Clasificar año 2024") se deshabilita al encolar y muestra **"En cola"**
- [ ] Cuando el worker empieza ese job, el literal cambia a **"En progreso…"** (polling del `job_id` devuelto)
- [ ] Al completarse, vuelve al estado original del botón (o muestra "Completado" brevemente)
- [ ] Si el usuario recarga la página y el job sigue activo, el botón recupera el estado correcto consultando el `job_id` guardado en `localStorage` o en la propia respuesta de la API
- [ ] Si hay un job `pending` o `in_progress` para esa misma carpeta/año, el botón aparece ya bloqueado al cargar la vista

### Panel `/jobs`

- [ ] Lista de jobs con: tipo, payload resumido, estado, progreso `processed/total`, errores, inicio
- [ ] Cada job muestra un **enlace "Ver origen"** que lleva a la vista desde la que se encoló (ej. `/library?year=2024`, `/library?folder=ID`)
- [ ] El enlace de origen se deriva del `payload` del job — no requiere campo extra en BD
- [ ] Actualización automática cada 3s sin recargar la página
- [ ] Botón "Cancelar" para jobs `pending` e `in_progress`
- [ ] Jobs `completed` y `failed` se conservan 48h y luego se purgan automáticamente
- [ ] Badge en el sidebar cuando hay ≥1 job `pending` o `in_progress`

---

## Componentes afectados

| Fichero | Cambio |
|---|---|
| `src/lib/db.ts` | Migración: crear tabla `job_queue` |
| `src/lib/queries/jobs.ts` | CRUD: createJob, getNextPending, updateProgress, cancel, purgeOld |
| `src/lib/worker.ts` | Singleton worker: bucle de consumo, lógica de reanudación |
| `src/app/api/ai/classify/batch/route.ts` | Encola el job, devuelve `{ jobId }` en lugar de hacer streaming |
| `src/app/api/ai/classify/year/route.ts` | Idem |
| `src/app/api/jobs/route.ts` | GET lista de jobs |
| `src/app/api/jobs/[id]/route.ts` | GET progreso, DELETE para cancelar |
| `src/app/jobs/page.tsx` | Panel `/jobs` con polling cada 3s |
| `src/components/Sidebar.tsx` | Badge de jobs activos |
| `src/components/ClassifyProvider.tsx` | Adaptar a respuesta `{ jobId }` en lugar de streaming |

---

## Consideraciones técnicas

### Singleton en Next.js

El worker singleton vive como variable de módulo. En producción (`next start`) el proceso Node es estable. En desarrollo (`next dev`) HMR puede reiniciar módulos — si eso ocurre, el worker se re-inicializa y retoma desde SQLite automáticamente (es exactamente para lo que está diseñado).

```typescript
// src/lib/worker.ts
let workerStarted = false;

export function ensureWorkerRunning() {
  if (workerStarted) return;
  workerStarted = true;
  processQueue(); // bucle async que no bloquea
}
```

`ensureWorkerRunning()` se llama en cualquier route que encole un job, y también en el arranque del servidor.

### Cancelación

El worker comprueba el status del job en SQLite antes de procesar cada foto. Si encuentra `cancelled`, para el bucle limpiamente sin dejar fotos a medias.

---

## Fuera de alcance

- Cola multi-usuario o multi-instancia
- Prioridad entre jobs
- Notificaciones push al completar
- Múltiples workers en paralelo (un job a la vez — US-070 gestiona el paralelismo interno)
- Reintentos automáticos de jobs fallidos
