# Feature: Optimización de rendimiento — queries DB y polling

## Historia de usuario

Como fotógrafo con una biblioteca grande (10.000+ fotos),
quiero que la aplicación cargue los datos de forma eficiente y no haga peticiones innecesarias al servidor cuando está inactiva,
para que el NAS no esté bajo carga constante y las vistas carguen rápido.

---

## Descripción

El audit de deuda técnica identificó cuatro problemas de rendimiento que afectan directamente a usuarios con bibliotecas grandes: el patrón N+1 de queries de tags (201 queries por cada carga de 200 fotos), la ausencia de índice GPS (full table scan en cada carga del mapa), el polling constante cada 2 segundos aunque no haya ninguna operación activa, y la descarga de hasta 2000 fotos en JSON de una sola vez al expandir un evento.

Estos problemas son silenciosos: la app funciona, pero genera carga innecesaria al NAS y degrada la experiencia con bibliotecas grandes. Esta US los resuelve todos con cambios concretos y bien delimitados.

---

## Criterios de aceptación

### Índice GPS en el esquema de la DB
- [ ] `src/lib/db.ts` añade en `initSchema` el índice: `CREATE INDEX IF NOT EXISTS idx_photos_gps ON photos(gps_lat, gps_lon) WHERE gps_lat IS NOT NULL;`
- [ ] El índice es parcial (`WHERE gps_lat IS NOT NULL`) para no indexar fotos sin GPS
- [ ] La migración es segura: `CREATE INDEX IF NOT EXISTS` no falla si el índice ya existe
- [ ] En la próxima carga del mapa con 10.000+ fotos, el `EXPLAIN QUERY PLAN` de la query debe mostrar uso del índice en lugar de `SCAN TABLE`

### Eliminar N+1 en `/api/photos` — tags con JOIN
- [ ] La ruta `src/app/api/photos/route.ts` reemplaza el bucle `tagStmt.all(p.id)` con un `LEFT JOIN` usando `GROUP_CONCAT`:
  ```sql
  SELECT p.*, GROUP_CONCAT(t.name || ':' || pt.source, ',') as tag_list
  FROM photos p
  LEFT JOIN photo_tags pt ON pt.photo_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE ... GROUP BY p.id ORDER BY ... LIMIT ?
  ```
- [ ] El campo `tag_list` se parsea en el servidor: split por `,`, luego split por `:` para obtener `{ name, source }`
- [ ] El resultado tiene la misma estructura `{ tags: Array<{ name, source }> }` que el actual
- [ ] El número de queries por request se reduce de `N+1` a `1`

### Reducir límite de fotos por evento en PhotoGrid
- [ ] `src/components/PhotoGrid.tsx` reduce el límite de `fetch` al expandir un evento de `limit=2000` a `limit=300`
- [ ] Se añade un botón "Cargar más" que aparece al llegar al final de las fotos cargadas si hay más disponibles
- [ ] La paginación usa `offset` en la query existente
- [ ] La experiencia visual es equivalente (las fotos cargan progresivamente, no hay pantalla en blanco)

### Polling con backoff exponencial en ScanProvider y ClassifyProvider
- [ ] Cuando `running=false` y el estado de scan/classify no está activo, el intervalo de polling aumenta progresivamente: 2s → 5s → 10s → 30s → 30s (capped)
- [ ] Cuando se detecta `running=true` (operación en curso), el intervalo vuelve a 2s inmediatamente
- [ ] Cuando el usuario enfoca la pestaña del navegador (`visibilitychange` event), se fuerza una actualización inmediata del estado
- [ ] El comportamiento visible es idéntico: el toast de scan aparece y desaparece con el mismo timing cuando hay un scan activo

---

## API necesaria

La ruta `GET /api/photos` se modifica internamente para usar JOIN+GROUP_CONCAT pero su contrato externo (parámetros y estructura de respuesta) no cambia.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/db.ts` | Añadir `CREATE INDEX idx_photos_gps` en `initSchema` |
| `src/app/api/photos/route.ts` | Reemplazar N+1 tags con JOIN+GROUP_CONCAT |
| `src/components/PhotoGrid.tsx` | Reducir límite a 300, añadir "Cargar más" |
| `src/components/ScanProvider.tsx` | Backoff exponencial en polling |
| `src/components/ClassifyProvider.tsx` | Backoff exponencial en polling |

---

## Notas técnicas

- `GROUP_CONCAT` en SQLite tiene un separador configurable; usar `,` como separador y `|` o `::` para separar nombre de source (evitar colisiones si los tag names contienen comas).
- El índice parcial `WHERE gps_lat IS NOT NULL` solo existe en SQLite ≥3.8.0 (disponible en todas las distribuciones modernas; verificar la versión bundled con `better-sqlite3`).
- Para el backoff en `ScanProvider`, el intervalo se puede implementar con `setTimeout` variable en lugar de `setInterval` fijo. Al recibir la respuesta, programar el siguiente poll con el delay calculado.
- `visibilitychange` se escucha con `document.addEventListener('visibilitychange', ...)` en un `useEffect` de cleanup.
- El botón "Cargar más" en `PhotoGrid` puede seguir el patrón de `visible`/`PAGE_SIZE` ya existente, que ya implementa renderizado progresivo. La carga adicional desde el servidor solo se dispara cuando el usuario llega al final de las fotos ya descargadas.

---

## Fuera de alcance (v1)

- Virtualización del DOM de la galería (react-virtual o similar) para reducir nodos en el DOM
- Prefetch de la siguiente "página" de eventos antes de que el usuario la solicite
- Caché del lado del cliente con SWR o React Query
- Optimización `O(n²)` en el índice de posición de fotos de `TimelineClient` (cubierto en la US de deuda técnica menor)
