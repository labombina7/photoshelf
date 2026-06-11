# Feature: Limpieza de thumbnails huérfanos y queries inline a repositorio

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador de photoshelf,
quiero que el borrado de un catálogo limpie los thumbnails generados para sus fotos y que los route handlers de photos no accedan directamente a la BD,
para que la caché de thumbnails no crezca indefinidamente y la capa de repositorio sea la única fuente de SQL en el proyecto.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó dos problemas relacionados con la consistencia entre datos en disco y la capa de acceso a datos:

**1. Thumbnails huérfanos al borrar un catálogo**: cuando se borra un catálogo, los registros de fotos se eliminan de la BD pero los thumbnails generados en `CACHE_PATH` permanecen para siempre. En una biblioteca grande con múltiples tamaños de thumbnail, el directorio de caché puede crecer varias decenas de GB con ficheros que ya no corresponden a ninguna foto indexada. El integrity scanner es el lugar natural para detectar y limpiar estos thumbnails huérfanos.

**2. `getDb()` directamente en route handlers de photos**: los handlers `src/app/api/photos/[id]/original/route.ts` y `src/app/api/photos/[id]/thumbnail/route.ts` importan `getDb()` directamente para ejecutar `SELECT p.path, p.filename, COALESCE(c.path, ?) FROM photos ... WHERE p.id = ?`. Esta query debería vivir en `src/lib/queries/photos.ts`, consistente con la convención establecida en CLAUDE.md y aplicada en US-046.

---

## Criterios de aceptación

### Limpieza de thumbnails huérfanos
- [ ] Al borrar un catálogo, los thumbnails del directorio `CACHE_PATH` correspondientes a las fotos de ese catálogo se eliminan antes de borrar los registros de BD
- [ ] Si `CACHE_PATH` no contiene thumbnails para esas fotos (primera ejecución o caché ya vacía), la operación no falla
- [ ] El integrity scanner incluye una nueva categoría de issue: `orphan_thumbnail` (thumbnail en caché sin foto en BD)
- [ ] En `/api/integrity/scan`, el tipo `orphan_thumbnail` se detecta y reporta
- [ ] En `/api/integrity/resolve`, se puede resolver un `orphan_thumbnail` eliminando el fichero de caché
- [ ] La UI de integridad (`/tools/integrity`) muestra los thumbnails huérfanos y permite resolverlos

### Queries inline a repositorio
- [ ] `src/app/api/photos/[id]/original/route.ts` no importa `getDb()` directamente
- [ ] `src/app/api/photos/[id]/thumbnail/route.ts` no importa `getDb()` directamente
- [ ] Existe `getPhotoPathById(id: number)` (o similar) en `src/lib/queries/photos.ts` que retorna `{ path, filename, catalog_path } | null`
- [ ] Ambos handlers importan la nueva función desde el repositorio
- [ ] El build de TypeScript pasa sin errores

### Sin regresiones
- [ ] Las fotos de catálogos no borrados siguen sirviendo sus thumbnails correctamente
- [ ] El borrado de un catálogo sin thumbnails en caché no falla
- [ ] Los tests existentes de integrity siguen pasando

---

## API necesaria

No se requieren endpoints nuevos. Se extiende el tipo de `integrity_reports` con `type = 'orphan_thumbnail'` (ya tiene `CHECK(type IN ('orphan', 'unindexed', 'corrupt'))` — requiere migración para añadir el nuevo tipo).

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/queries/photos.ts` | Añadir `getPhotoPathById(id)` retornando path + catalog_path |
| `src/app/api/photos/[id]/original/route.ts` | Usar función del repositorio en lugar de `getDb()` directo |
| `src/app/api/photos/[id]/thumbnail/route.ts` | Usar función del repositorio en lugar de `getDb()` directo |
| `src/lib/queries/catalogs.ts` | En `deleteCatalog`, limpiar thumbnails antes de borrar registros |
| `src/lib/integrityScanner.ts` | Detectar thumbnails en caché sin foto en BD |
| `src/lib/db.ts` | Migración para añadir `orphan_thumbnail` al CHECK de `integrity_reports.type` |
| `src/app/tools/integrity/IntegrityClient.tsx` | Mostrar y resolver thumbnails huérfanos |

---

## Notas técnicas

- La limpieza de thumbnails en `deleteCatalog` debe ocurrir dentro de la transacción si es posible, o justo antes de los DELETEs de BD (los thumbnails son una caché regenerable, por lo que borrarlos antes de la BD es seguro)
- La estructura de nombres de fichero de thumbnails en `CACHE_PATH` sigue el patrón `{hash_del_path}-{size}.webp` — revisar `src/lib/thumbnail.ts` para obtener la función que genera el nombre
- La migración del CHECK constraint requiere reconstruir la tabla `integrity_reports` (mismo patrón que `migrateUniquePath` en db.ts) o simplificar el CHECK a `NOT NULL`

---

## Fuera de alcance (v1)

- Limpieza automática programada de thumbnails huérfanos (sin intervención del usuario)
- Thumbnail de preview en la lista de issues de integridad
- Limpieza de thumbnails al eliminar una foto individual (las fotos no se pueden borrar desde la UI actualmente)
