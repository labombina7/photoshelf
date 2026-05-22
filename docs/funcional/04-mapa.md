# Mapa

La vista **Mapa** (`/map`) muestra en un mapa interactivo todas las fotos que contienen coordenadas GPS en sus metadatos EXIF.

## Funcionamiento

- Al cargar la página se obtienen todas las fotos con GPS del endpoint `/api/photos/map`
- Los marcadores se renderizan sobre un mapa de **OpenStreetMap** mediante **Leaflet.js**
- El mapa ajusta automáticamente el encuadre (`fitBounds`) para mostrar toda la colección

## Clustering

Las fotos cercanas se agrupan automáticamente en **clusters numerados** gracias al plugin `leaflet.markercluster`. Al hacer zoom, los clusters se dividen progresivamente hasta mostrar los marcadores individuales.

## Marcadores

Cada foto individual se representa con:
- Un marcador circular de 44 px con la miniatura de la foto
- Borde blanco y sombra para destacar sobre el mapa

## Panel lateral

Al pulsar un marcador se abre un **panel lateral** con:
- Miniatura de 64 px
- Nombre de archivo
- Fecha de toma
- Nombre del evento
- Enlace "Abrir foto →" que navega a `/library/[id]`

Si varias fotos comparten exactamente las mismas coordenadas, todas se muestran en el panel.

En mobile el panel ocupa la parte inferior de la pantalla en lugar del lateral.

## Contador

La topbar muestra: **"N fotos en el mapa · M sin ubicación"**, indicando cuántas fotos tienen GPS y cuántas no.

## Privacidad y coste

- Los tiles del mapa se sirven desde **OpenStreetMap** (gratuito, sin API key)
- Las fotos nunca se envían al servidor de tiles — solo se muestran localmente en el navegador
- La atribución requerida por OSM aparece en la esquina inferior derecha
