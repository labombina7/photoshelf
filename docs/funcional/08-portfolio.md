# Portfolio

La sección **Portfolio** (`/projects`) permite crear proyectos fotográficos curados — selecciones coherentes de fotos con un título y un statement artístico.

## ¿Qué es un proyecto?

Un proyecto es una selección ordenada de fotos que conforman una obra o presentación cohesionada. Cada proyecto tiene:
- **Título**: nombre del proyecto
- **Statement**: texto de 2-3 frases explicando la intención artística
- **Selección**: fotos ordenadas narrativamente (apertura → desarrollo → climax → cierre)

## Generación con IA

photoshelf puede generar proyectos automáticamente usando Ollama como curador virtual. El proceso es:

1. El usuario define el **alcance** (año, evento, temática o toda la biblioteca)
2. Configura el **número de fotos** y filtros opcionales:
   - **Tono**: solo color, solo b&w, o mezcla
   - **Estilos** (orientación estética, no filtro estricto)
   - **Tags requeridos** (filtros duros)
3. Ollama actúa como curador experto:
   - Lee la lista completa de candidatas con sus tags
   - Aplica los filtros duros (tono, tags obligatorios)
   - Selecciona las mejores fotos priorizando diversidad de eventos y riqueza de tags
   - Ordena la selección con un arco narrativo visual
   - Genera título y statement en español

## Gestión de proyectos

- Los proyectos aparecen listados en el sidebar para acceso rápido
- Cada proyecto tiene su página de detalle con las fotos en orden
- Se pueden reordenar fotos dentro del proyecto
- Se puede eliminar el proyecto (las fotos no se ven afectadas)

## Requisito

La generación con IA requiere Ollama configurado (`OLLAMA_URL`). Los proyectos también pueden crearse manualmente seleccionando fotos sin usar la IA.
