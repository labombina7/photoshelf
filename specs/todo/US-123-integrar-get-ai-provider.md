# Feature: Integrar getAIProvider() en todas las funciones que usan Ollama directamente

## Historia de usuario

Como usuario de photoshelf,
quiero que la clasificación, búsqueda semántica, valoración de fotos y análisis de estilo usen el proveedor configurado en ajustes,
para que al cambiar de Ollama a Anthropic todas las funciones de IA respeten esa elección sin configuración adicional.

---

## Descripción

Hoy todas las funciones de IA llaman directamente a Ollama via `fetch` contra `localhost:11434`. Esta US conecta la factory `getAIProvider()` (definida en US-021) con todas las funciones consumidoras. Después de esta US, cambiar el proveedor en `/settings/ai` cambia el comportamiento de toda la IA de la app.

También implementa el comportamiento cuando la IA está desactivada (`enabled = false`): las funciones devuelven `null` o un estado vacío, y la UI reacciona apropiadamente.

---

## Criterios de aceptación

### Funciones migradas
- [ ] `classifyPhoto()` usa `getAIProvider().generateVision()`
- [ ] `parseSearchQuery()` usa `getAIProvider().generateText()`
- [ ] `reviewPhoto()` usa `getAIProvider().generateVision()`
- [ ] `photoMatchesConcept()` usa `getAIProvider().generateVision()`
- [ ] `generateProject()` usa `getAIProvider().generateText()`
- [ ] `analyzeStyleSample()` (Tu Estilo) usa `getAIProvider().generateVision()`

### IA desactivada
- [ ] Si `enabled = false`, `getAIProvider()` devuelve `null`
- [ ] Las funciones consumidoras devuelven early con un estado "IA no disponible"
- [ ] La UI: botón de clasificar deshabilitado con tooltip, sección de valoración oculta, Tu Estilo oculto

### Sin regresión
- [ ] Con Ollama activo y configurado, el comportamiento es idéntico al actual
- [ ] Los tests existentes de clasificación siguen en verde

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/lib/ai/index.ts` | `getAIProvider(): AIProvider \| null` — lee `ai_config` de BD |
| `src/lib/ollama/classify.ts` | Migrar a `getAIProvider()` |
| `src/lib/ollama/search.ts` | Migrar a `getAIProvider()` |
| `src/lib/ollama/client.ts` | Refactor o deprecar si ya no tiene consumidores directos |
| `src/lib/style-analysis/` | Migrar llamadas a `getAIProvider()` |

---

## Notas técnicas

- `getAIProvider()` lee `ai_config` de BD en cada llamada (o con caché de corta duración) — evita que un cambio en settings requiera reiniciar el servidor
- El adaptador Ollama (de US-021) se inicializa con la URL y modelos configurados en BD, no desde `.env`
- El adaptador Anthropic (de US-021) se inicializa con la API key de BD

---

## Dependencias

- **US-121** — tabla `ai_config` para leer configuración
- **US-021** — interfaz `AIProvider` y adaptadores (Ollama, Anthropic)
- Parte de **EPIC-007**

## Fuera de alcance

- Fallback automático a otro proveedor si el activo falla
- Cache de resultados entre proveedores
