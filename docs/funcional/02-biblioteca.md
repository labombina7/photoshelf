# Biblioteca

La vista **Biblioteca** (`/library`) es el punto de entrada principal de photoshelf. Muestra todas las fotos organizadas por carpeta de evento.

## Vista de carpetas

Por defecto se muestra una cuadrícula de carpetas/eventos. Cada tarjeta muestra:
- Miniatura de portada del evento
- Nombre del evento
- Año
- Número de fotos

Al hacer clic en una carpeta se accede a las fotos de ese evento.

## Vista de fotos (cuadrícula y lista)

Dentro de un evento hay dos modos de visualización:

- **Cuadrícula**: miniaturas cuadradas en grid adaptable
- **Lista**: filas con miniatura pequeña + metadatos (filename, fecha, cámara)

## Filtros disponibles

Desde el sidebar y la topbar se pueden aplicar los siguientes filtros:

| Filtro | Descripción |
|---|---|
| **Favoritos** | Solo fotos marcadas con estrella |
| **Sin clasificar** | Fotos sin ningún tag asignado |
| **Temática** | Fotos asociadas a una temática concreta |
| **Búsqueda** | Por nombre de archivo, evento o tag |

## Detalle de foto

Al pulsar cualquier foto se abre el visor de detalle (`/library/[id]`) con:

- Imagen a tamaño completo (con opción de abrir original)
- **Metadatos EXIF**: fecha, cámara, exposición (velocidad/apertura/ISO), dimensiones, tamaño de archivo
- **Coordenadas GPS** si están disponibles
- **Tags** asignados (manuales y de IA), con opción de añadir/eliminar
- **Temáticas** asociadas
- **Review de IA** (si Ollama está configurado): composición, luz, puntos fuertes/débiles, puntuación 1-10
- Botón de favorito
- Navegación anterior/siguiente

## Escaneo de biblioteca

El botón **"Reescanear biblioteca"** en la parte inferior del sidebar lanza un proceso de escaneo que:

1. Recorre toda la estructura `AÑO/EVENTO/foto`
2. Extrae metadatos EXIF (fecha, cámara, exposición, GPS) de cada archivo
3. Inserta o actualiza los registros en la base de datos
4. Muestra un toast de progreso en tiempo real

Los formatos soportados son: `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`, `.tif`, `.tiff`.
