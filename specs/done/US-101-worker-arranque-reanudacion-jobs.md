# Feature: Arranque del worker con el servidor y reanudación de jobs

## Historia de usuario

Como operador de photoshelf,
quiero que los trabajos en cola (clasificación, backups, generación de proyectos) se reanuden automáticamente tras un reinicio del contenedor,
para que no queden congelados días enteros hasta que alguien visite la app.

---

## Descripción

El tech debt audit del 2026-06-12 detectó que el worker de jobs solo arranca cuando alguna ruta llama a `ensureWorkerRunning()` (`/api/jobs`, `/api/ai/classify/*`, `/api/projects/generate`). El diseño de recuperación es correcto — `getNextJob()` prioriza jobs `in_progress` y los reanuda — pero tras reiniciar el contenedor nadie ejecuta el loop: un classify a medias, o el auto-backup vencido (`scheduleAutoBackupIfDue`), esperan indefinidamente hasta que un usuario navegue a una de esas rutas.

En un servidor doméstico que se reinicia por actualizaciones del NAS, esto significa backups que no se hacen y clasificaciones que parecen colgadas (el polling de la UI tampoco las ve avanzar).

---

## Criterios de aceptación

### Arranque con el servidor
- [ ] `instrumentation.ts` llama a `ensureWorkerRunning()` en el runtime nodejs, junto al watcher
- [ ] Tras un reinicio con un job `in_progress` en BD, el job continúa sin intervención del usuario
- [ ] El auto-backup vencido se encola al arrancar aunque nadie visite la app

### Observabilidad
- [ ] Log al arrancar: cuántos jobs pending/in_progress se encontraron
- [ ] Si un job `in_progress` lleva más de 24 h desde `started_at` al arrancar, se marca `failed` con `error_last = 'Stale job tras reinicio'` en lugar de reanudarse a ciegas (evita zombies de payloads corruptos)

### Tests
- [ ] Test de `getNextJob` que verifica la prioridad in_progress → pending
- [ ] Test del marcado de jobs stale

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/instrumentation.ts` | Llamada a `ensureWorkerRunning()` en `register()` |
| `src/lib/worker.ts` | Log de arranque + detección de jobs stale |
| `src/lib/queries/jobs.ts` | Helper para marcar jobs stale |

---

## Notas técnicas

- `ensureWorkerRunning` ya es idempotente vía `globalThis.__photoshelf_worker_running` — la llamada extra desde instrumentation no duplica loops.
- Cuidado con el orden: el worker necesita la BD inicializada; `getDb()` es lazy así que basta con importar dentro de `register()` como ya se hace con el watcher.

---

## Fuera de alcance (v1)

- Reintentos automáticos con backoff de jobs failed
- Concurrencia de múltiples jobs en paralelo

> Estado: ✅ Desplegada
