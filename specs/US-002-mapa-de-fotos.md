# Feature: Mapa de Fotos

## Historia de usuario

Como fotógrafo que viaja y toma fotos en distintas ubicaciones,
quiero explorar mi biblioteca en un mapa interactivo agrupado por lugar,
para descubrir y acceder a fotos por dónde fueron tomadas, no solo por cuándo.

---

## Descripción

Una vista nueva accesible desde el sidebar llamada **"Mapa"**. Muestra un mapa interactivo con marcadores o clusters que representan fotos que tienen coordenadas GPS (`gps_lat` / `gps_lon`). Al hacer zoom en el mapa los clusters se abren y revelan las fotos individuales. Al pulsar un marcador se abre un mini-panel lateral con las fotos de esa ubicación.

La base de datos ya almacena `gps_lat` y `gps_lon` extraídas del EXIF durante el escaneo. Solo hay que exponer esos datos y renderizarlos.

El mapa usa **Leaflet.js** con tiles de OpenStreetMap (sin coste, sin API key). Para la agrupación se usa **Leaflet.markercluster** (plugin CSS+JS).

Las fotos sin GPS no aparecen en el mapa; en la parte inferior se muestra un contador de "N fotos sin ubicación".

---

## Criterios de aceptación

### Vista general
- [ ] Mapa renderizado a pantalla completa (minus sidebar y topbar)
- [ ] Tiles de OpenStreetMap cargados via Leaflet.js
- [ ] Solo aparecen fotos con `gps_lat IS NOT NULL AND gps_lon IS NOT NULL`
- [ ] Al cargar, el mapa hace `fitBounds` sobre todos los marcadores para encuadrar la colección
- [ ] Un contador en el topbar muestra "N fotos en el mapa · M sin ubicación"

### Clustering
- [ ] Fotos cercanas se agrupan en clusters numerados (Leaflet.markercluster)
- [ ] Al hacer zoom los clusters se dividen progresivamente
- [ ] Al hacer clic sobre un cluster el mapa hace zoom hacia él

### Marcadores individuales
- [ ] Cada marcador muestra la miniatura de la foto (40×40 px, circular)
- [ ] Al pulsar un marcador se abre un panel lateral con las fotos de ese punto
- [ ] Si varias fotos comparten coordenadas exactas se muestran todas en el panel
- [ ] El panel lateral muestra: miniatura grande, filename, fecha, event

### Panel lateral
- [ ] Aparece al pulsar cualquier marcador o cluster expandido
- [ ] Se cierra con una X o pulsando fuera del panel
- [ ] Enlace "Abrir foto" lleva a `/library/[id]`
- [ ] Si el cluster agrupa fotos de distintos eventos, las agrupa visualmente por event

### Sin GPS
- [ ] Banner/nota en la UI indicando cuántas fotos no tienen ubicación
- [ ] Las fotos sin GPS no generan error ni marcador vacío

### Performance
- [ ] El endpoint devuelve solo `id`, `gps_lat`, `gps_lon`, `filename`, `taken_at`, `event`; no datos pesados
- [ ] El clustering ocurre en cliente (Leaflet); el endpoint devuelve hasta 10 000 registros en una sola llamada
- [ ] Las miniaturas de marcador usan `/api/photos/[id]/thumbnail?size=80`

---

## API necesaria

### `GET /api/photos/map`

Devuelve todas las fotos con coordenadas GPS.

**Respuesta:**
```json
{
  "photos": [
    {
      "id": 42,
      "filename": "DSC_0001.jpg",
      "taken_at": "2024-05-14T10:23:00",
      "event": "Roma 2024",
      "gps_lat": 41.9028,
      "gps_lon": 12.4964
    }
  ],
  "total": 1204,
  "withGps": 873
}
```

---

## Ruta y navegación

- Ruta: `/map`
- Enlace en sidebar bajo "Biblioteca", después de "Línea de tiempo"
- Icono: `IconMap` (mapa/pin)
- Activo cuando `pathname === '/map'`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/map/page.tsx` | Server component — carga stats iniciales (total, withGps) |
| `src/app/map/MapClient.tsx` | Client component — Leaflet, clustering, panel lateral |
| `src/app/api/photos/map/route.ts` | Endpoint GPS |
| `src/components/Icons.tsx` | Añadir `IconMap` |
| `src/components/Sidebar.tsx` | Añadir enlace al mapa |

---

## Notas técnicas

- Leaflet y Leaflet.markercluster se importan dinámicamente con `next/dynamic` + `ssr: false` para evitar errores SSR con `window`
- Los tiles de OpenStreetMap no requieren API key pero sí attributing: `© OpenStreetMap contributors`
- Para marcadores con miniatura se usa `L.divIcon` con un `<img>` interno
- El endpoint puede limitarse a `WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL` directamente en SQLite

---

## Fuera de alcance (v1)

- Filtrar el mapa por año, tema o tag
- Geocodificación inversa (obtener nombre de ciudad desde coordenadas)
- Edición manual de coordenadas GPS
- Exportar el mapa como imagen
