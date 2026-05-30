# Feature: Refactorización de ollama.ts en submódulos y centralización de constantes

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador de photoshelf,
quiero que la integración con Ollama esté dividida en módulos con responsabilidades claras y que las constantes de configuración estén en un único lugar,
para poder añadir nuevos modelos, cambiar timeouts o refactorizar la lógica de IA sin navegar 340 líneas de un fichero monolítico.

---

## Descripción

`src/lib/ollama.ts` tiene actualmente 341 líneas y contiene cinco responsabilidades distintas mezcladas: extracción de JSON de respuestas, escape de XML para prompts, lectura y resize de imágenes, comunicación HTTP (texto y visión), clasificación de fotos, parsing de queries de búsqueda, generación de proyectos y review de fotos.

Esta mezcla de responsabilidades hace difícil:
- Añadir un nuevo proveedor de IA (US-021) sin tocar todo el fichero
- Testear funciones individuales de parsing sin mockear el HTTP completo
- Encontrar la función correcta rápidamente

Paralelamente, hay constantes dispersas (`30_000`, `120_000`, `512`, `5_000`) sin nombres descriptivos que dificultan entender su propósito y cambiarlos de forma segura.

---

## Criterios de aceptación

### Estructura de submódulos
- [ ] Se crea la estructura `src/lib/ollama/`:
  - `client.ts` — función `callOllama(prompt, model, options)` y `callOllamaVision(prompt, imageBase64, model, options)` (HTTP puro)
  - `image.ts` — `readPhotoAsJpegBase64(path)` (lectura + resize con sharp)
  - `classify.ts` — `classifyPhoto(photoId, path)` y `extractJsonObject(text)` + helpers de parsing
  - `search.ts` — `parseSearchQuery(text)` y helpers de parsing de búsqueda
  - `review.ts` — `reviewPhoto(photoId, path)` 
  - `projects.ts` — `generateProject(photos, options)`
  - `index.ts` — re-exporta todo el API público (para compatibilidad con los importadores existentes)
- [ ] El fichero original `src/lib/ollama.ts` queda como barrel que importa y re-exporta desde `src/lib/ollama/index.ts`

### Sin regresiones de comportamiento
- [ ] Todos los importadores de `@/lib/ollama` siguen funcionando sin cambios (gracias al barrel)
- [ ] Los tests existentes de ollama siguen pasando
- [ ] El comportamiento de clasificación, búsqueda, review y generación es idéntico

### Centralización de constantes
- [ ] Las constantes de timeout y configuración se añaden en `src/lib/config.ts` o `src/lib/constants.ts`:
  - `OLLAMA_TIMEOUT_TEXT_MS = 30_000`
  - `OLLAMA_TIMEOUT_VISION_MS = 120_000`
  - `OLLAMA_TIMEOUT_CLASSIFY_MS = 180_000`
  - `OLLAMA_IMAGE_SIZE = 512`
  - `WATCHER_DEBOUNCE_MS = 5_000`
  - `WATCHER_POLL_MS = 30_000`
  - `AUTH_RATE_LIMIT_ATTEMPTS = 10`
  - `AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000`
- [ ] Los magic numbers en `ollama.ts`, `folderWatcher.ts`, `thumbnail.ts` y `auth/login/route.ts` se reemplazan por las constantes con nombre

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/ollama/client.ts` | Nuevo — HTTP con Ollama (texto y visión) |
| `src/lib/ollama/image.ts` | Nuevo — lectura y resize de imagen para IA |
| `src/lib/ollama/classify.ts` | Nuevo — clasificación de fotos y parsing JSON |
| `src/lib/ollama/search.ts` | Nuevo — parsing de queries de búsqueda |
| `src/lib/ollama/review.ts` | Nuevo — review de fotos |
| `src/lib/ollama/projects.ts` | Nuevo — generación de proyectos |
| `src/lib/ollama/index.ts` | Nuevo — re-exporta el API público |
| `src/lib/ollama.ts` | Simplificar a barrel `export * from './ollama/index'` |
| `src/lib/config.ts` | Añadir constantes con nombre para timeouts y tamaños |
| `src/lib/folderWatcher.ts` | Usar constantes `WATCHER_DEBOUNCE_MS`, `WATCHER_POLL_MS` |
| `src/app/api/auth/login/route.ts` | Usar constantes de rate limiting |

---

## Notas técnicas

- El objetivo es que `src/lib/ollama.ts` sea un fichero de 3-5 líneas que solo re-exporta
- Priorizar que los tests existentes sigan pasando — el refactor no debe cambiar ningún comportamiento
- `extractJsonObject` debería estar en `classify.ts` o en un `src/lib/ollama/utils.ts` compartido si se reutiliza en múltiples módulos
- Esta refactorización es el prerrequisito natural para US-021 (proveedores LLM cloud)

---

## Fuera de alcance (v1)

- Tests unitarios de las funciones de parsing (cubrir en US-048)
- Integración con OpenAI o Anthropic como providers alternativos (ver US-021)
- Logging estructurado con pino u otra librería
