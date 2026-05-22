# Línea de tiempo

La vista **Línea de tiempo** (`/timeline`) organiza todas las fotos cronológicamente con scroll infinito y zoom temporal unificado.

## Niveles de zoom

El selector de nivel en la topbar controla simultáneamente la agrupación temporal y la densidad visual de las miniaturas:

| Nivel | Agrupación | Columnas (desktop) | Tamaño thumbnail |
|---|---|---|---|
| **Año** | Grupos por año | 10 columnas | 100 px |
| **Mes** | Grupos por mes | 5 columnas | 200 px |
| **Día** | Grupos por día | 3 columnas | 300 px |

## Navegación

- **Clic en botón Año / Mes / Día**: cambia el nivel de zoom
- **Ctrl + scroll**: cambia de nivel sin usar el ratón
- **Teclas `+` / `−`**: avanza o retrocede un nivel
- **Doble tap** (mobile): alterna entre Mes y Día

## Scroll infinito

Las fotos se cargan en páginas a medida que el usuario hace scroll hacia abajo. El número de fotos por página se adapta automáticamente al nivel de zoom activo (entre 24 y 120 fotos por carga).

El sentinel del IntersectionObserver tiene un margen de anticipación de 800 px para precargar el siguiente bloque antes de que el usuario llegue al final.

## Header flotante

El nombre del período activo (año, mes o día) aparece fijado en la parte superior del área de scroll, actualizándose conforme el usuario avanza por la página.

## Optimización de carga

- **Skeleton shimmer**: cada celda muestra un placeholder animado hasta que la miniatura carga
- **`fetchPriority="high"`**: las primeras imágenes visibles se descargan con prioridad para mejorar el LCP
- **Fade-in**: las imágenes aparecen con una transición suave de opacidad
- **Prefetch proactivo**: al cargar un nuevo bloque se anticipan los thumbnails del siguiente

## Persistencia

El nivel de zoom seleccionado se guarda en `sessionStorage` y se restaura al volver a la vista.
