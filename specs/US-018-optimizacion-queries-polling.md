# Feature: Optimización de queries N+1, polling y índices de base de datos

## Historia de usuario

Como fotógrafo con una biblioteca de miles de fotos en un NAS,
quiero que la app consuma los mínimos recursos posibles en el servidor,
para que el NAS no trabaje innecesariamente cuando estoy navegando por mis fotos.

---

## Descripción

El análisis de rendimiento identificó tres problemas que generan carga innecesaria continua:

1. **N+1 en tags**: cuando se cargan fotos en el timeline o la library, se hace una query
   adicional por foto para obtener sus tags, resultando en N+1 queries por página.
2. **Polling agresivo del estado de escaneo**: el cliente hace polling cada 2 segundos mientras
   hay un scan activo, generando peticiones continuas al servidor del NAS.
3. **Sin índice en coordenadas GPS**: la vista de mapa hace queries con filtros de bounding box
   sobre `latitude` y `longitude` sin índice, forzando un full table scan.

---

## Criterios de aceptación

### Fix de N+1 en tags
- [ ] La query principal de fotos (listado, timeline, library) incluye los tags en la misma query
  usando `GROUP_CONCAT` o una subconsulta, eliminando las queries individuales por foto
- [ ] El formato de tags en la respuesta JSON es el mismo que antes (`string[]`)
- [ ] En una biblioteca de 1000 fotos, la carga de una página del timeline genera ≤ 5 queries SQL
  (en lugar de N+1)

### Optimización del polling de scan
- [ ] El intervalo de polling del estado de scan se aumenta de 2s a **5s** como mínimo
- [ ] Cuando el scan termina (status = `idle` o `done`), el cliente detiene el polling inmediatamente
- [ ] Se explora y documenta si `EventSource` (SSE) es viable como alternativa al polling;
  si lo es, se implementa SSE en lugar del intervalo

### Índices de base de datos
- [ ] Se añade un índice en `(latitude, longitude)` de la tabla `photos` para las queries de mapa
- [ ] Se añade un índice en `(year, event)` para las queries de agrupación del timeline (si no existe)
- [ ] Los índices se añaden en el script de inicialización de la DB (`src/lib/db.ts`) con `IF NOT EXISTS`
- [ ] En una biblioteca de 5000 fotos, la query de mapa (bounding box) tarda < 50ms

### Sin regresiones
- [ ] El comportamiento de la UI es idéntico antes y después de las optimizaciones
- [ ] Los tests existentes siguen pasando

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/db.ts` | Añadir índices GPS y year/event |
| `src/app/api/photos/route.ts` | Query con JOIN/GROUP_CONCAT para tags |
| `src/app/api/timeline/route.ts` | Query con tags incluidos |
| `src/components/ScanProgress.tsx` | Aumentar intervalo de polling a 5s |
| `src/app/api/scan/status/route.ts` | (Opcional) SSE en lugar de polling |

---

## Notas técnicas

- `GROUP_CONCAT(t.name, ',')` en SQLite es la forma más eficiente de incluir tags en la query principal
- Los índices en SQLite son baratos de mantener y prácticamente gratuitos en tablas de sólo escritura
- El índice compuesto `(latitude, longitude)` en SQLite mejora el bounding box si la query filtra
  primero por latitude (SQLite usa el primer campo del índice compuesto)
- SSE requiere que Next.js devuelva un `ReadableStream` con `Content-Type: text/event-stream`

---

## Fuera de alcance (v1)

- Caché en memoria de resultados de queries (requiere invalidación)
- WebSockets para estado de scan en tiempo real
- Paginación del servidor de mapa (clustering en servidor)
- Explain plan automático en CI para detectar regresiones de rendimiento
