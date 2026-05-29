# US-032: Búsqueda IA con indicador visual y resultados en área principal

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** M
> **Dependencias:** US-031

---

## Historia

**Como** usuario de photoshelf,  
**quiero** saber cuándo una búsqueda está siendo procesada por IA y ver sus resultados de forma destacada,  
**para** entender la diferencia entre una búsqueda rápida y una búsqueda inteligente, y aprovechar mejor sus resultados.

---

## Contexto

En la búsqueda actual (`AISearchPanel`), el usuario no sabe si la búsqueda fue rápida o profunda hasta que lee los metadatos del resultado. Con la búsqueda unificada, el clasificador (US-029) decidirá automáticamente cuando una query requiere IA — pero el usuario debe verlo claramente, tanto en el header durante la búsqueda como en la página de resultados.

Además, la búsqueda IA profunda (análisis visual foto a foto con Ollama) puede tardar 30-60s. Esta US diseña la experiencia de espera y la presentación de resultados incrementales.

---

## Criterios de aceptación

### Indicador en el header

- [ ] Cuando el clasificador decide `ai`, la barra de búsqueda muestra un badge `✦ IA` junto al texto de la query antes de lanzar la búsqueda
- [ ] El badge aparece en < 50ms (es solo el clasificador heurístico, no Ollama)
- [ ] El color del badge es diferente al de la barra normal (p.ej. acento del sistema, no el gris neutro)
- [ ] Durante la búsqueda IA, el spinner del header muestra `✦` en lugar del icono de lupa

### Indicador en la página de resultados

- [ ] El encabezado de resultados muestra el badge `✦ Búsqueda IA` cuando `isAI: true` viene en la respuesta del API
- [ ] Debajo del encabezado aparece una línea explicativa: `La IA ha interpretado tu búsqueda como: "[concepto extraído]"`
- [ ] Esta línea solo aparece cuando el concepto extraído por Ollama es diferente de la query original

### Búsqueda IA rápida (modo quick)

- [ ] Ollama extrae concepto + tags de la query
- [ ] Los resultados aparecen en la página `/search` en el área principal, igual que cualquier otra búsqueda
- [ ] El tiempo de respuesta se muestra en el footer de resultados: `Búsqueda completada en 1.2s`

### Búsqueda IA profunda (modo deep)

- [ ] La búsqueda profunda se activa manualmente desde la página de resultados, no automáticamente
- [ ] Hay un botón en la página de resultados IA: `Analizar fotos con visión IA (más lento)`
- [ ] Al activar el modo profundo, la página muestra una barra de progreso: `Analizando 50/320 fotos…`
- [ ] Los resultados del modo profundo aparecen incrementalmente en el grid a medida que llegan (sin necesidad de recargar)
- [ ] Hay un botón `Analizar 50 más` cuando quedan fotos sin analizar (igual que el comportamiento actual de AISearchPanel)

### Guardar como temática

- [ ] El botón "Guardar como temática" solo aparece en resultados IA (no en búsquedas keyword)
- [ ] Funciona igual que en el AISearchPanel actual: permite nombrar la temática y asociar las fotos encontradas
- [ ] Aparece en la parte inferior de la sección de resultados de fotos

### Forzar búsqueda IA

- [ ] El usuario puede forzar una búsqueda IA aunque el clasificador haya decidido otro intent, añadiendo `?mode=ai` a la URL o usando el botón en el estado vacío (US-031)
- [ ] La barra de búsqueda muestra el badge `✦ IA` cuando `mode=ai` está en la URL

---

## Notas técnicas

- El badge `✦ IA` en el header se calcula en el cliente con `classifyQuery` (US-029) mientras el usuario escribe — se actualiza en tiempo real con debounce de 300ms
- Para el modo profundo incremental, el `SearchPageClient` usa `fetch` con streaming o polling al endpoint `/api/ai/search` existente (adaptar si es necesario)
- El color del badge IA puede ser `var(--accent-ai)` — una nueva variable CSS a añadir al tema

---

## Fuera de alcance

- Modo profundo automático sin confirmación del usuario
- Comparar resultados IA vs resultados keyword lado a lado
- Explicabilidad de los resultados IA (por qué apareció esta foto)
---

> Estado: ✅ Desplegada
