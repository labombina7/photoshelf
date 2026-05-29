# Búsqueda

photoshelf incluye un sistema de búsqueda unificado accesible desde la barra del header en cualquier página. El sistema clasifica automáticamente la intención de cada consulta y enruta al modo de búsqueda más adecuado.

## Acceso

La barra de búsqueda está siempre visible en el **header superior** de la aplicación. Atajo de teclado: `/` (fuera de un input abre y enfoca la barra). En mobile, la barra se activa al tocar el icono de búsqueda.

## Clasificación de intención

Cuando el usuario escribe una consulta, el sistema la analiza localmente (sin petición al servidor) usando hints de tags y eventos pre-cargados:

| Intención detectada | Ejemplo | Acción |
|---|---|---|
| `tag` | "b&w", "retrato" | Filtra la biblioteca por ese tag |
| `event` | "Boda Julia" | Filtra la biblioteca por ese evento |
| `year` | "2023" | Filtra la biblioteca por año |
| `ai` | "playa al atardecer" | Búsqueda semántica con IA en `/search` |
| `text` | "IMG_0042" | Búsqueda por nombre de archivo |

## Autocompletado y historial

Mientras el usuario escribe, el dropdown muestra:
- **Historial reciente** de búsquedas (localStorage)
- **Sugerencias de tags** que coinciden con el texto
- **Sugerencias de eventos** que coinciden con el texto

## Página de resultados (`/search`)

Las consultas de tipo `ai` o `text` llevan a la página `/search?q=<consulta>`, que muestra:

### Resultados de fotos

Grid de fotos que coinciden con la búsqueda. Cada foto es clicable para abrir su detalle.

### Resultados de tags

Tags que coinciden con la consulta, con su contador de fotos. Al pulsar un tag se abre la biblioteca filtrada.

### Resultados de eventos

Eventos que coinciden con la consulta. Al pulsar un evento se abre la biblioteca filtrada.

### Búsqueda profunda con IA (modo visual)

Desde la página de resultados, el botón **"✦ Buscar con IA"** activa la búsqueda profunda:

1. Ollama procesa visualmente cada foto de la colección con `llama3.2-vision:11b`
2. Determina si la foto muestra el concepto buscado
3. Como efecto secundario, asigna tags a las fotos analizadas
4. Los resultados se van mostrando en tiempo real a medida que se procesan

> ⚠️ La búsqueda profunda es lenta (cada foto tarda varios segundos) y se recomienda acotar con filtros previos.

## Guardar como temática

Al obtener resultados de búsqueda visual, aparece la opción **"Guardar como temática"** para crear una colección permanente con las fotos encontradas.

## Taxonomía de tags para búsqueda IA

Los tags reconocidos por el modelo son:

- **Tono**: `b&w`, `color`
- **Estilos**: `portrait`, `landscape`, `street`, `fashion`, `editorial`, `architecture`, `macro`, `product`, `documentary`, `wildlife`, `travel`, `sport`, `abstract`
- **Género**: `personal`, `work`, `travel`, `event`, `nature`

## Requisito

La búsqueda semántica profunda requiere Ollama configurado con el modelo `llama3.2-vision:11b`. La búsqueda por tags, eventos y texto funciona siempre, sin Ollama.
