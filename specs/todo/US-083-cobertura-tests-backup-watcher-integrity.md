# Feature: Cobertura de tests — backup, folderWatcher, integrityScanner y deleteCatalog

## Historia de usuario

Como desarrollador de photoshelf,
quiero que las funciones más críticas para la integridad de datos tengan tests unitarios,
para poder refactorizar con confianza y detectar regresiones antes de que lleguen a producción.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó cuatro áreas sin cobertura de tests que corresponden a las operaciones con mayor riesgo de pérdida de datos:

**1. `deleteCatalog` sin tests**: es la operación más destructiva del sistema — borra permanentemente todos los registros de fotos de un catálogo. No existe ningún test que verifique sus restricciones (no borrar catálogo 1, no borrar el activo) ni su comportamiento transaccional.

**2. `backup.ts` sin tests**: la lógica de backup (creación del directorio, VACUUM INTO, exportación JSON, rotación de ficheros) no tiene ninguna cobertura. Un error en la rotación podría borrar backups recientes.

**3. `folderWatcher.ts` sin tests**: el watcher contiene lógica de debounce y comparación de snapshots de directorios que puede tener edge cases sutiles (directorios renombrados, escaneo ya en curso). Sin tests es imposible verificar que `scheduleAutoScan` se dispara correctamente.

**4. `integrityScanner.ts` sin tests**: el scanner detecta fotos huérfanas (en BD pero no en disco) y no indexadas (en disco pero no en BD). La lógica de clasificación no tiene ningún test.

La infraestructura de Vitest + mocks de `fs` y `getDb` ya está establecida (ver US-048 desplegada).

---

## Criterios de aceptación

### deleteCatalog
- [ ] Test: borrado exitoso de un catálogo no-principal elimina sus fotos y el registro del catálogo
- [ ] Test: intentar borrar catálogo id=1 lanza error sin modificar la BD
- [ ] Test: intentar borrar un catálogo inexistente lanza error
- [ ] Test: la función opera dentro de una transacción (ambos DELETEs o ninguno)

### backup.ts
- [ ] Test: `runBackup()` crea el fichero `.db` y el `.json` en `BACKUP_PATH`
- [ ] Test: si `BACKUP_PATH` no tiene permisos de escritura, lanza error descriptivo
- [ ] Test: la rotación elimina el fichero más antiguo cuando se supera `BACKUP_MAX_KEEP`
- [ ] Test: el JSON exportado contiene las secciones `photo_tags`, `themes`, `projects`, `favorites`

### folderWatcher
- [ ] Test: `scheduleAutoScan` se llama cuando `buildDirSnapshot` detecta un directorio nuevo
- [ ] Test: si el scan ya está en curso (`getScanState().running === true`), no se lanza un segundo escaneo
- [ ] Test: el debounce agrupa múltiples cambios en una sola llamada

### integrityScanner
- [ ] Test: una foto en BD pero sin fichero en disco se clasifica como `orphan`
- [ ] Test: un fichero en disco con extensión válida pero sin registro en BD se clasifica como `unindexed`
- [ ] Test: ficheros con extensión no soportada son ignorados

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/catalogs/__tests__/catalogs.test.ts` | Añadir casos para `deleteCatalog` |
| `src/lib/__tests__/backup.test.ts` | Tests nuevos para `backup.ts` |
| `src/lib/__tests__/folderWatcher.test.ts` | Tests nuevos para `folderWatcher.ts` |
| `src/lib/__tests__/integrityScanner.test.ts` | Tests nuevos para `integrityScanner.ts` |

---

## Notas técnicas

- Usar `vi.mock('fs')` y `vi.mock('fs/promises')` para simular el filesystem sin tocar disco
- Usar `vi.mock('@/lib/db')` con una BD SQLite in-memory para `deleteCatalog` y `backup`
- El patrón de mock ya está establecido en `src/lib/__tests__/scanner.test.ts` — seguirlo
- Para `folderWatcher`, usar `vi.useFakeTimers()` para controlar el debounce sin `setTimeout` real

---

## Fuera de alcance (v1)

- Tests de integración end-to-end para el watcher (requeriría sistema de ficheros real)
- Tests de concurrencia para el scan (se cubren en US-078)
