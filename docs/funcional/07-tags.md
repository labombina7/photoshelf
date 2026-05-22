# Tags

El sistema de **Tags** permite etiquetar las fotos para facilitar su búsqueda y organización. Los tags pueden ser asignados manualmente o generados automáticamente por IA.

## Vista de Tags (`/tags`)

Nube de tags con todos los que existen en la biblioteca. El tamaño de cada tag es proporcional a su frecuencia de uso. Al pulsar un tag se accede a la galería de fotos con ese tag.

## Fuentes de tags

| Fuente | Descripción |
|---|---|
| **Manual** | Añadidos directamente por el usuario en el detalle de la foto |
| **IA** | Generados automáticamente por Ollama al clasificar la foto |

En la interfaz los tags muestran una insignia distinta según su origen.

## Tags generados por IA

Cuando Ollama está configurado, la clasificación de una foto genera hasta 6 tags siguiendo esta taxonomía:

1. **Tono**: `b&w` o `color`
2. **Estilos** (hasta 2): `portrait`, `landscape`, `street`, `fashion`, `editorial`, `architecture`, `macro`, `product`, `documentary`, `wildlife`, `travel`, `sport`, `abstract`
3. **Género**: `personal`, `work`, `travel`, `event`, `nature`
4. **Sujeto/mood** (1-2): tags específicos del contenido

## Clasificación manual vs automática

- Desde el detalle de la foto se puede **clasificar con IA** individualmente
- Desde la biblioteca por año se puede lanzar la **clasificación en batch** de todo un año
- El **vigilante de carpetas** lanza la clasificación automáticamente tras detectar fotos nuevas (si Ollama está configurado)

## Sin clasificar

Las fotos sin ningún tag aparecen en la sección **"Sin clasificar"** del sidebar, facilitando localizar el trabajo de etiquetado pendiente.
