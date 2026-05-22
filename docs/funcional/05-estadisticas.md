# Estadísticas

La vista **Estadísticas** (`/stats`) ofrece un dashboard con métricas de la colección fotográfica.

## Tarjetas resumen

En la parte superior aparecen cuatro tarjetas con cifras globales:

| Tarjeta | Descripción |
|---|---|
| **Total fotos** | Número total de fotos en la biblioteca |
| **Peso total** | Suma del tamaño en disco de todas las fotos |
| **Favoritos** | Número de fotos marcadas como favoritas |
| **Sin clasificar** | Fotos que no tienen ningún tag asignado |

## Gráficos

### Fotos por año
Gráfico de barras verticales. Cada barra es clicable y navega a la biblioteca filtrada por ese año.

### Fotos por mes (año seleccionable)
Mapa de calor de 12 celdas con la distribución mensual del año seleccionado. La altura de relleno es proporcional al número de fotos de ese mes.

### Distribución horaria
Histograma de 24 barras (0h–23h) con el número de fotos tomadas a cada hora del día. Útil para identificar patrones de trabajo.

### Cámaras más usadas
Barras horizontales con las 6 cámaras o combinaciones Make+Model más frecuentes en los metadatos EXIF.

### Tags más frecuentes
Lista de tags ordenada por uso, con desglose visual entre **IA** (generados automáticamente), **manual** (añadidos por el usuario) o **mixto** (ambos).

## Implementación

Todos los gráficos son SVG puros — sin ninguna librería de charting externa. Los datos se obtienen directamente de SQLite mediante queries agregadas en el servidor.
