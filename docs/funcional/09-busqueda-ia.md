# Búsqueda con IA

photoshelf incluye un panel de búsqueda inteligente que combina dos modos: búsqueda rápida por tags y búsqueda profunda por visión computacional.

## Acceso

El botón **"Buscar"** en la topbar de la biblioteca abre el panel de búsqueda con IA.

## Modo rápido (búsqueda por tags)

Interpreta la consulta en lenguaje natural y la convierte en filtros de tags:

1. Ollama analiza el texto y extrae: año (opcional), concepto visual y tags relevantes
2. Se buscan en la base de datos las fotos que tienen esos tags
3. Los resultados aparecen al instante

**Ejemplo**: "retratos en blanco y negro" → tags: `[b&w, portrait]`

## Modo profundo (búsqueda por visión)

Analiza visualmente cada foto de la colección:

1. Ollama procesa la imagen con el modelo `llama3.2-vision:11b`
2. Determina si la foto coincide con el concepto buscado
3. Como efecto secundario, asigna tags a las fotos analizadas
4. Devuelve solo las fotos que realmente muestran el concepto

**Ejemplo**: "playa al atardecer" → analiza cada foto y devuelve solo las que visualmente corresponden

> ⚠️ La búsqueda profunda es lenta (30-120 segundos por foto) y se recomienda acotar el alcance con filtros de año o tags previos.

## Taxonomía de tags para búsqueda

Los tags reconocidos por el sistema de IA son:

- **Tono**: `b&w`, `color`
- **Estilos**: `portrait`, `landscape`, `street`, `fashion`, `editorial`, `architecture`, `macro`, `product`, `documentary`, `wildlife`, `travel`, `sport`, `abstract`
- **Género**: `personal`, `work`, `travel`, `event`, `nature`

## Requisito

Requiere Ollama configurado con el modelo `llama3.2-vision:11b`.
