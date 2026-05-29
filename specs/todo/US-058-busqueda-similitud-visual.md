# Feature: Búsqueda por similitud visual ("fotos parecidas a esta")

## Historia de usuario

Como fotógrafo que quiere encontrar fotos con el mismo estilo, ambiente o composición,
quiero poder pulsar "buscar fotos similares a esta" en cualquier foto de mi biblioteca,
para descubrir series, duplicar estilos o crear colecciones temáticas de forma visual.

---

## Descripción

La búsqueda semántica actual de photoshelf parte de texto: el usuario describe lo que busca en palabras y la IA busca fotos que coincidan. Esta US invierte el flujo: el usuario señala una foto existente como referencia y pide "encuéntrame fotos parecidas a esta".

Los casos de uso son distintos a la búsqueda textual:
- Encontrar todas las fotos con luz de atardecer similar sin saber cómo describirla
- Recuperar fotos de la misma sesión dispersas en distintos eventos
- Construir una temática visualmente cohesiva partiendo de una foto que "funciona"
- Encontrar variantes de una misma composición a lo largo de los años

La implementación aprovecha Ollama con un modelo vision: para la foto referencia, se genera una descripción detallada de sus características visuales (luz, composición, paleta, sujetos, estilo). Esa descripción se usa como query de búsqueda semántica en la colección.

---

## Criterios de aceptación

### Activación
- [ ] En el detalle de cualquier foto, existe un botón "Buscar similares" (o icono de ondas) en la barra de acciones
- [ ] Solo visible si Ollama está configurado
- [ ] Al pulsarlo, navega a `/search?similar_to={photoId}`

### Página de resultados
- [ ] La página `/search?similar_to=ID` muestra en el header: miniatura de la foto referencia + "Fotos similares a esta"
- [ ] El sistema analiza la foto referencia con Ollama vision y genera una query de búsqueda interna (no visible al usuario directamente, pero un "¿Qué buscamos?" expandible puede mostrarla)
- [ ] Los resultados se muestran en grid ordenados por relevancia estimada
- [ ] La foto referencia se excluye de los resultados
- [ ] Indicador de progreso mientras Ollama analiza la foto referencia

### Calidad de resultados
- [ ] Los resultados incluyen una etiqueta de similaridad: "muy similar", "similar", "relacionada"
- [ ] El usuario puede refinar con filtros adicionales: año, evento, tags — sin perder el contexto de similaridad
- [ ] Botón "Guardar como temática" para persistir los resultados (igual que la búsqueda IA existente)

### Comportamiento si Ollama no responde
- [ ] Si Ollama falla, se muestra el mensaje de error específico (igual que la búsqueda IA existente)
- [ ] No hay fallback silencioso — el error debe ser visible

---

## API necesaria

### `GET /api/search/similar?photo_id={id}&limit={n}`
Analiza la foto referencia con Ollama, genera una descripción visual y ejecuta la búsqueda semántica.

```json
{
  "reference_photo": { "id": 42, "filename": "...", "thumbnail": "..." },
  "query_generated": "fotografía con luz cálida de atardecer, silueta contra el horizonte, composición minimalista...",
  "results": [
    { "id": 78, "filename": "...", "similarity": "very_similar", "score": 0.92 }
  ]
}
```

La implementación interna puede reutilizar el pipeline de búsqueda IA existente en `src/lib/search/`, usando la descripción generada de la foto referencia como input.

---

## Ruta y navegación

- Ruta: `/search?similar_to={photoId}` (extiende la ruta de búsqueda existente)
- Acceso: botón en el detalle de foto (solo si Ollama disponible)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/search/page.tsx` | Detectar param `similar_to` y renderizar cabecera de referencia |
| `src/app/search/SimilaritySearch.tsx` | Nuevo — cabecera con miniatura referencia + descripción generada |
| `src/app/api/search/similar/route.ts` | Nuevo — análisis + búsqueda |
| `src/lib/search/similar.ts` | Nuevo — lógica: describe foto referencia → search semántico |
| `src/app/(library)/[year]/[event]/[photoId]/PhotoDetailClient.tsx` | Botón "Buscar similares" |

---

## Notas técnicas

- El prompt de Ollama para describir la foto referencia debe incluir: paleta de colores dominante, tipo de luz, composición (regla de tercios, centrado...), tipo de sujeto, ambiente/mood. El objetivo es generar una query de texto rica para la búsqueda semántica.
- Reutilizar `src/lib/ollama.ts` que ya maneja las llamadas vision a Ollama.
- La búsqueda semántica resultante puede usar el mismo flujo que `/api/search` con el texto generado como query y `type: 'ai'`.
- El `score` de similaridad es una estimación heurística basada en cuántos conceptos de la descripción coinciden con los tags IA existentes de cada foto — no es un embedding real de similitud visual.

---

## Fuera de alcance (v1)

- Embeddings vectoriales reales para similaridad semántica (requiere modelo de embeddings separado)
- Búsqueda por imagen cargada desde fuera de la biblioteca (upload externo)
- Filtro de similaridad ajustable ("solo muy similares")
- Comparación visual side-by-side con la referencia desde los resultados
