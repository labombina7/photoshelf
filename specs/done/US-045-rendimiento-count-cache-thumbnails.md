# Feature: Rendimiento — count de paginación correcto, caché de hints y evicción de thumbnails

## Historia de usuario

Como fotógrafo con una biblioteca grande de varios miles de fotos,
quiero que la paginación muestre el total correcto cuando hay filtros activos y que la app no consuma recursos innecesarios con búsquedas frecuentes ni llene el disco con thumbnails acumulados,
para tener información fiable y un sistema que funcione bien a largo plazo.

---

## Descripción

La auditoría de deuda técnica identificó tres problemas de rendimiento que impactan directamente en la fiabilidad y el uso de recursos del sistema:

**1. `COUNT(*)` incorrecto en `listPhotos`**: la función `listPhotos` devuelve siempre el count total del catálogo, independientemente de los filtros aplicados (año, evento, tag, favorito). Esto hace que `hasMore` y el total mostrado al usuario sean incorrectos cuando hay filtros activos — la barra de paginación puede mostrar "1 de 3.000" cuando solo hay 47 fotos que coinciden con el filtro.

**2. `loadHints` carga todos los tags en cada búsqueda**: la función `loadHints` en `execute.ts` hace `SELECT name FROM tags ORDER BY name ASC` (sin límite) en cada llamada a `executeSearch`. Con miles de tags esto puede producir respuestas lentas y arrays grandes en memoria que se descartan inmediatamente.

**3. Caché de thumbnails sin evicción**: los thumbnails WebP generados se almacenan en `data/.cache/` de forma indefinida. En una biblioteca grande con múltiples tamaños, el directorio puede crecer a decenas de GB sin que nada lo limpie.

---

## Criterios de aceptación

### Count filtrado en `listPhotos`
- [ ] La función `listPhotos` en `src/lib/queries/photos.ts` calcula el `total` aplicando los mismos joins y condiciones de filtro que la query principal
- [ ] El total devuelto refleja el número de fotos que coinciden con los filtros activos, no el total del catálogo
- [ ] `hasMore` en la respuesta paginada es correcto: `hasMore = offset + results.length < total`
- [ ] No hay regresión de rendimiento: el count filtrado usa la misma cláusula WHERE que ya tiene el filtro, no hace un segundo scan completo

### Caché en `loadHints`
- [ ] `loadHints` en `src/lib/search/execute.ts` cachea el resultado en memoria con un TTL de 60 segundos
- [ ] El caché se invalida si se añade o elimina un tag (o simplemente expira por TTL)
- [ ] Alternativamente, se limita a los N tags más frecuentes (`ORDER BY uso DESC LIMIT 500`) en lugar de todos
- [ ] En benchmarks con 1000 búsquedas seguidas, la query a la BD se ejecuta ≤ 1 vez por minuto (en lugar de 1000)

### Evicción de caché de thumbnails
- [ ] Existe un script o función en `src/lib/thumbnail.ts` que limpia entradas de `data/.cache/` con antigüedad > 30 días
- [ ] La limpieza se ejecuta automáticamente: al arrancar el servidor (en `instrumentation.ts`) o como tarea periódica semanal
- [ ] La limpieza no elimina thumbnails accedidos recientemente (usa `atime` o `mtime` del archivo)
- [ ] Se loguea el número de archivos eliminados y el espacio liberado: `console.info('[cache] Limpieza: N thumbnails, X MB liberados')`
- [ ] La limpieza es no bloqueante (no retrasa el arranque del servidor)

---

## API necesaria

No se añaden endpoints nuevos. Los cambios son internos a la capa de repositorio y a los módulos de utilidad.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/queries/photos.ts` | Corregir `COUNT(*)` para aplicar filtros; función `countPhotos(filters)` |
| `src/lib/search/execute.ts` | Caché en memoria con TTL para `loadHints` |
| `src/lib/thumbnail.ts` | Función `evictOldThumbnails(maxAgeDays: number)` |
| `src/instrumentation.ts` | Llamar a `evictOldThumbnails(30)` al arrancar en modo non-blocking |

---

## Notas técnicas

- Para el count filtrado: reutilizar `buildPhotoFilter` de `src/lib/db-helpers.ts` que ya construye la cláusula WHERE + params. Añadir una query `SELECT COUNT(*) FROM photos ...` con el mismo WHERE.
- Para el caché de hints: un objeto en módulo `{ data: string[], expiresAt: number }` es suficiente. No hace falta Redis ni nada externo.
- Para la evicción de thumbnails: `fs.readdir(cacheDir)` + `fs.stat(file).mtimeMs` comparado con `Date.now() - maxAgeDays * 86400000`. Ejecutar en `setImmediate()` para no bloquear el event loop al arrancar.
- El directorio de caché es `data/.cache/` — verificar que `CACHE_PATH` está correctamente referenciado desde `config.ts`.

---

## Fuera de alcance (v1)

- Límite de tamaño del caché en GB (requiere ordenar por tamaño y eliminar los más grandes primero)
- Caché de resultados de queries de photos (requiere invalidación más compleja)
- Clustering del lado del servidor para la vista de mapa
- Backoff exponencial en el polling de scan/classify (cubrir en US separada)

> Estado: ✅ Desplegada — merged en main el 2026-05-30
