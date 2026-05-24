# Feature: Mapa — filtro por año y carga progresiva

## Historia de usuario

Como fotógrafo con un catálogo grande,
quiero poder filtrar el mapa por año,
para explorar mis fotos geoetiquetadas de un viaje o período concreto sin que el mapa se quede
colgado intentando pintar miles de marcadores a la vez.

---

## Descripción

El mapa actual carga todas las fotos con GPS de golpe (`LIMIT 10000`). Con catálogos grandes esto
provoca dos problemas: la petición API devuelve un payload enorme, y el bucle de creación de
marcadores en Leaflet bloquea el hilo principal varios segundos antes de que el mapa sea
interactivo.

La solución es añadir un **selector de año** en la topbar del mapa. Al elegir un año, el cliente
recarga solo las fotos de ese período (~100–2000 puntos en lugar de >10k), el mapa re-centra
automáticamente en la región de esas fotos, y la experiencia pasa de "cuelgue" a respuesta
inmediata.

Como mejora adicional, se elimina el `LIMIT 10000` arbitrario del repositorio: con el filtro
de año en uso, ya no es necesario limitar artificialmente — el año actúa como paginación natural.
Para la vista "Todos los años" se mantiene un límite configurable y se muestra un aviso si se
supera.

---

## Criterios de aceptación

### Selector de año en la UI

- [ ] La topbar del mapa muestra un selector de año: pills horizontales con los años disponibles
  (solo años que tienen al menos una foto con GPS), más la opción "Todos"
- [ ] El año activo se resalta visualmente (mismo estilo que los botones de zoom en el timeline)
- [ ] Al cambiar de año, los marcadores se actualizan sin recargar la página (SPA navigation):
  1. Se muestran los marcadores actuales con opacidad reducida
  2. Se lanza la petición con el nuevo año
  3. Al recibir la respuesta, se limpia el cluster y se añaden los nuevos marcadores
  4. El mapa hace `fitBounds` al bounding box del nuevo año
- [ ] Si no hay fotos con GPS en el año seleccionado, se muestra el mensaje:
  "No hay fotos con ubicación para [año]"
- [ ] El contador de la topbar ("X fotos en el mapa") refleja el año activo, no el total

### API — soporte de filtro en la ruta

- [ ] `GET /api/photos/map?year=2024` devuelve solo las fotos de ese año con GPS
- [ ] `GET /api/photos/map` (sin parámetro) sigue funcionando y devuelve todas
- [ ] La respuesta incluye los años disponibles para el selector:
  `{ photos: [...], withGps: N, availableYears: [2024, 2023, 2022, ...] }`
- [ ] Si el año solicitado no tiene fotos con GPS, devuelve `{ photos: [], withGps: 0, availableYears: [...] }`

### Repositorio

- [ ] `getMapPhotos(year?: number): MapPhoto[]` acepta año opcional; aplica `WHERE year = ?`
  cuando se pasa
- [ ] `getMapYears(): number[]` — nueva función que devuelve los años con al menos una foto
  con GPS, en orden descendente
- [ ] `countWithGps(year?: number): number` — acepta año opcional para el contador de la topbar
- [ ] Se elimina el `LIMIT 10000` de `getMapPhotos` cuando hay filtro de año activo
- [ ] Para "Todos los años" (sin filtro), se mantiene un `LIMIT 5000` y se añade el campo
  `limitReached: boolean` en la respuesta si `photos.length === 5000`

### Estado inicial

- [ ] Al abrir el mapa, se selecciona automáticamente el año más reciente con fotos GPS
  (no "Todos"), para que la primera carga sea rápida
- [ ] Si solo hay un año disponible, no se muestra el selector (no aporta valor)

### Compatibilidad

- [ ] El comportamiento existente de clic en marcador → panel lateral con miniaturas se mantiene
  intacto
- [ ] La ruta `/map` sigue siendo accesible sin query params (no breaking change en URLs)

---

## Componentes nuevos o modificados

| Componente | Cambio |
|---|---|
| `src/lib/queries/photos.ts` | `getMapPhotos(year?)`, `getMapYears()`, `countWithGps(year?)` |
| `src/app/api/photos/map/route.ts` | Leer `?year=`, llamar a funciones del repositorio con filtro |
| `src/app/map/MapClient.tsx` | Selector de año, recarga de markers sin reinicializar el mapa |
| `src/app/map/page.tsx` | Pasar `availableYears` como prop inicial (pre-cargados en servidor) |

---

## Notas técnicas

- El selector de año debe pre-cargarse en el Server Component (`page.tsx`) para evitar un
  flash de "sin años" en el cliente. `getMapYears()` es barata (una query sobre un índice).
- Al limpiar y recargar marcadores, usar `cluster.clearLayers()` antes de re-añadir para
  evitar fugas de memoria. La instancia del mapa Leaflet NO se destruye al cambiar de año.
- La transición de opacidad al cargar nuevos markers es cosmética (`opacity: 0.4` en el
  contenedor del mapa durante la carga), no requiere lógica compleja.
- Los `availableYears` de la respuesta API son redundantes con los del servidor, pero permiten
  actualizar el selector si el usuario escaneara nuevas fotos sin recargar la página (futuro).
- Relación con **US-026**: el selector de año puede reutilizar los mismos estilos de pill/button
  que se definan para los controles de zoom del timeline en la US de personalidad visual.

---

## Fuera de alcance (v1)

- Filtro por evento dentro de un año en el mapa
- Filtro por rango de fechas (date range picker)
- Clustering con color según año (heatmap temporal)
- Exportar puntos GPS a GPX/KML
- Carga incremental de marcadores con virtualización (puede hacerse en v2 si con el filtro
  de año sigue siendo lento)
