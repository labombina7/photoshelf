# Feature: Hardening transaccional — deleteCatalog y guard atómica en scan

## Historia de usuario

Como usuario de photoshelf,
quiero que el borrado de un catálogo y el inicio de un escaneo sean operaciones seguras frente a crashes y peticiones concurrentes,
para que un fallo a mitad de operación no deje la base de datos en estado inconsistente ni se lancen dos escaneos en paralelo.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó dos problemas críticos de integridad relacionados con la atomicidad de operaciones destructivas:

**1. `deleteCatalog` sin transacción SQLite**: la función ejecuta dos sentencias `DELETE` separadas (`DELETE FROM photos` y `DELETE FROM catalogs`). Si el proceso muere o el servidor se reinicia entre ambas, el catálogo queda en BD sin fotos (o viceversa). No hay rollback posible. La solución es envolver ambas sentencias en `db.transaction(...)`, que better-sqlite3 ejecuta de forma síncrona y atómica.

**2. Race condition en `POST /api/scan`**: la comprobación `getScanState().running` y la actualización posterior no son atómicas. Dos peticiones que lleguen con pocos milisegundos de diferencia pueden superar el check simultáneamente y lanzar dos escaneos paralelos sobre el mismo catálogo. Aunque el `ON CONFLICT DO UPDATE` de SQLite absorbe los duplicados, se consume el doble de CPU/red y los contadores de progreso quedan inconsistentes. La solución es asignar `running = true` de forma síncrona antes de devolver la respuesta, y rechazar la segunda petición inmediatamente.

Ambos fixes son quirúrgicos y de bajo riesgo: no cambian interfaces ni comportamiento observable.

---

## Criterios de aceptación

### deleteCatalog transaccional
- [ ] `deleteCatalog` en `src/lib/queries/catalogs.ts` envuelve los dos DELETEs en `db.transaction(...)()`
- [ ] Si el primer DELETE tiene éxito pero el segundo falla (simulado en test), ningún cambio persiste en BD
- [ ] El comportamiento ante catálogo inexistente (lanza error antes de los DELETEs) no cambia

### Guard atómica en scan
- [ ] En `POST /api/scan`, el estado `running = true` se asigna síncronamente antes de llamar a `after()`
- [ ] Una segunda petición `POST /api/scan` mientras el primero está en curso recibe `409 Conflict` inmediatamente, igual que antes
- [ ] Si el servidor recibe dos peticiones simultáneas (test con Promise.all), solo una inicia el escaneo

### Sin regresiones
- [ ] Los tests existentes en `src/app/api/catalogs/__tests__/` siguen pasando
- [ ] Los tests de `src/app/api/scan/__tests__/` siguen pasando

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/queries/catalogs.ts` | Envolver `deleteCatalog` en `db.transaction()` |
| `src/app/api/scan/route.ts` | Asignar `running = true` síncronamente antes de `after()` |

---

## Notas técnicas

- `better-sqlite3` usa transacciones síncronas: `const tx = db.transaction(() => { ... }); tx();`
- Para la guard del scan: `updateScanState({ running: true, ... })` debe ejecutarse antes del `after(async () => {...})`, no dentro de él
- El `after()` ya existe para mantener el contexto vivo después del 202 — solo hay que adelantar la actualización del flag

---

## Fuera de alcance (v1)

- Soft-delete de fotos o catálogos (papelera)
- Bloqueo de concurrencia para la clasificación batch (tiene su propio mecanismo en `classifyState`)

> Estado: ✅ Desplegada
