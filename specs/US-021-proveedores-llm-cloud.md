# Feature: Proveedores LLM en la nube (OpenAI, Claude, Gemini)

> **Estado: ⬜ Pendiente**

## Historia de usuario

Como fotógrafo que usa photoshelf en un NAS o en la nube,
quiero elegir entre Ollama local o una cuenta de OpenAI, Anthropic (Claude) o Google (Gemini) como motor de IA,
para clasificar, valorar y buscar fotos con mejor calidad o sin depender de un Mac con Ollama encendido.

---

## Descripción

Hoy todas las operaciones de IA pasan por `src/lib/ollama.ts`, acoplado al endpoint `/api/generate` de Ollama y al modelo fijo `llama3.2-vision:11b`. Si `OLLAMA_URL` no está configurado o el servicio no responde, la IA queda desactivada.

Esta historia introduce una **capa de proveedor desacoplada** que expone las mismas capacidades de negocio (clasificación, búsqueda semántica, revisión crítica, generación de proyectos, matching visual) pero delegando las llamadas HTTP al proveedor elegido:

| Proveedor | Uso típico | Autenticación |
|-----------|------------|---------------|
| **Ollama** (por defecto) | IA local, sin enviar fotos a terceros | `OLLAMA_URL` |
| **OpenAI** | GPT-4o / GPT-4o-mini con visión | `OPENAI_API_KEY` |
| **Anthropic** | Claude 3.5 Sonnet / Haiku con visión | `ANTHROPIC_API_KEY` |
| **Google** | Gemini 2.0 Flash / 1.5 Flash con visión | `GOOGLE_AI_API_KEY` |

La selección del proveedor se hace por variable de entorno (`AI_PROVIDER`). Las API keys **solo viven en el servidor** (`.env`, Docker Compose o secretos del NAS); nunca se exponen al cliente ni se persisten en SQLite en v1.

Los prompts, parsers JSON y reglas de negocio actuales (`classifyPhoto`, `parseSearchQuery`, `reviewPhoto`, `generateProject`, `photoMatchesConcept`) se mantienen; solo cambia el transporte (`ollamaVision` / `ollamaText` → `completeVision` / `completeText` del adaptador activo).

---

## Criterios de aceptación

### Configuración y arranque
- [ ] Nueva variable `AI_PROVIDER` con valores: `ollama` | `openai` | `anthropic` | `google`
- [ ] Si `AI_PROVIDER` no está definida, se infiere `ollama` cuando existe `OLLAMA_URL`; en caso contrario la IA queda desactivada (comportamiento equivalente al actual)
- [ ] Al arrancar, si `AI_PROVIDER` requiere API key y esta falta o está vacía, la app lanza error claro: `Error: OPENAI_API_KEY is required when AI_PROVIDER=openai` (análogo para `anthropic` y `google`)
- [ ] En `NODE_ENV=test`, la validación de API keys puede omitirse o usar mocks
- [ ] `.env.example` documenta todas las variables nuevas con comentarios y ejemplos

### Variables de entorno por proveedor

| Variable | Obligatoria si | Descripción |
|----------|----------------|-------------|
| `AI_PROVIDER` | No | `ollama` (default implícito con `OLLAMA_URL`) |
| `OLLAMA_URL` | `AI_PROVIDER=ollama` | URL base (ej. `http://192.168.1.10:11434`) |
| `OLLAMA_MODEL` | No | Default: `llama3.2-vision:11b` |
| `OPENAI_API_KEY` | `AI_PROVIDER=openai` | Clave de cuenta OpenAI |
| `OPENAI_MODEL` | No | Default: `gpt-4o-mini` (texto y visión) |
| `ANTHROPIC_API_KEY` | `AI_PROVIDER=anthropic` | Clave de cuenta Anthropic |
| `ANTHROPIC_MODEL` | No | Default: `claude-3-5-haiku-20241022` |
| `GOOGLE_AI_API_KEY` | `AI_PROVIDER=google` | Clave de Google AI Studio |
| `GOOGLE_AI_MODEL` | No | Default: `gemini-2.0-flash` |

- [ ] Opcional: `AI_VISION_TIMEOUT_MS` y `AI_TEXT_TIMEOUT_MS` con defaults razonables (120s visión, 30s texto; 180s para `generateProject`)

### Capa de abstracción (`src/lib/ai/`)
- [ ] Se crea interfaz `LlmProvider` con métodos:
  - `completeText(prompt: string, options?: { timeoutMs?: number }): Promise<string>`
  - `completeVision(prompt: string, imageBase64: string, options?: { timeoutMs?: number }): Promise<string>`
  - `isConfigured(): boolean` — indica si el proveedor activo puede usarse
- [ ] Implementaciones: `OllamaProvider`, `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`
- [ ] Factory `getLlmProvider(): LlmProvider | null` lee `AI_PROVIDER` y devuelve la instancia correcta
- [ ] `readPhotoAsJpegBase64` se extrae a módulo compartido (`src/lib/ai/image.ts` o similar); todos los proveedores reciben la misma imagen JPEG ≤512px

### Mapeo de APIs por proveedor
- [ ] **Ollama**: mantiene compatibilidad con `/api/generate`, campo `images` para visión (comportamiento actual)
- [ ] **OpenAI**: Chat Completions o Responses API con `image_url` data-URI base64 para visión; modelo configurable
- [ ] **Anthropic**: Messages API con bloque `image` (base64, `media_type: image/jpeg`) para visión
- [ ] **Google**: `generateContent` de Gemini con `inlineData` para visión
- [ ] Los cuatro proveedores usan `temperature: 0` (o equivalente) en operaciones deterministas (clasificación, parseo JSON)

### Funciones de negocio (sin cambio de contrato público)
- [ ] `classifyPhoto`, `parseSearchQuery`, `reviewPhoto`, `generateProject`, `photoMatchesConcept` siguen exportándose desde el mismo punto de entrada (`src/lib/ai/index.ts` o `src/lib/ollama.ts` reexportando por compatibilidad)
- [ ] Si no hay proveedor configurado, las funciones lanzan `Error('AI provider not configured')` o devuelven vacío según el contrato actual de cada ruta API
- [ ] Los tipos `PhotoReview`, `ProjectCandidate`, `GeneratedProject`, `ProjectFilters` no cambian de forma

### Rutas API y consumidores
- [ ] Las rutas existentes siguen funcionando sin cambiar URLs:
  - `POST /api/ai/classify/[photoId]`, `batch`, `year`
  - `POST /api/ai/review/[photoId]`
  - `GET /api/ai/search`
  - `POST /api/projects/generate`
- [ ] `folderWatcher.ts` comprueba `getLlmProvider()?.isConfigured()` en lugar de solo `process.env.OLLAMA_URL`
- [ ] Los mensajes de error en UI mencionan el proveedor activo de forma genérica: *"Comprueba la configuración de IA"* en lugar de solo *"Ollama"* (alineado con US-011)

### Seguridad
- [ ] Las API keys nunca se envían al cliente ni aparecen en logs
- [ ] Los prompts de usuario en `parseSearchQuery` usan delimitación XML / `escapeXml` (US-014) independientemente del proveedor
- [ ] Las rutas que leen fotos del disco siguen usando `resolvePhotoPath` antes de enviar imagen al proveedor (US-015)

### Tests
- [ ] Tests unitarios del factory: proveedor correcto según `AI_PROVIDER`
- [ ] Tests de parsers JSON (`parseSearchResponse`, etc.) importan desde el módulo real (US-019)
- [ ] Cada adaptador tiene tests con `fetch` mockeado (sin llamadas reales a APIs de pago)
- [ ] Test de regresión: con `AI_PROVIDER=ollama` y mock, el flujo de `classifyPhoto` produce el mismo formato de tags

### Documentación
- [ ] `docs/tecnico/06-configuracion.md` describe `AI_PROVIDER` y las keys de cada proveedor
- [ ] `docs/tecnico/05-despliegue.md` incluye ejemplo Docker Compose para OpenAI y para Ollama
- [ ] Tabla comparativa breve: coste aproximado, privacidad (local vs nube), requisitos de red

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/ai/types.ts` | Interfaz `LlmProvider`, tipos de opciones |
| `src/lib/ai/image.ts` | `readPhotoAsJpegBase64` (extraído de ollama.ts) |
| `src/lib/ai/providers/ollama.ts` | Adaptador Ollama (lógica actual migrada) |
| `src/lib/ai/providers/openai.ts` | Adaptador OpenAI |
| `src/lib/ai/providers/anthropic.ts` | Adaptador Anthropic |
| `src/lib/ai/providers/google.ts` | Adaptador Gemini |
| `src/lib/ai/index.ts` | Factory, funciones de negocio exportadas |
| `src/lib/ollama.ts` | Deprecar: reexportar desde `ai/index` o eliminar tras migración |
| `src/lib/folderWatcher.ts` | Guard de IA con `isConfigured()` |
| `src/components/DetailPanel.tsx` | Mensajes de error genéricos de IA |
| `src/components/PhotoGrid.tsx` | Idem |
| `src/components/ProjectsClient.tsx` | Idem |
| `.env.example` | Variables `AI_PROVIDER` y keys |
| `docs/tecnico/06-configuracion.md` | Documentación de proveedores |

---

## Notas técnicas

### Arquitectura propuesta

```
src/lib/ai/
├── index.ts              # classifyPhoto, reviewPhoto, … + getLlmProvider()
├── image.ts              # readPhotoAsJpegBase64
├── types.ts              # LlmProvider
└── providers/
    ├── ollama.ts
    ├── openai.ts
    ├── anthropic.ts
    └── google.ts
```

Las rutas API y componentes importan desde `@/lib/ai` (o `@/lib/ollama` durante transición con reexport).

### Elección de modelos por defecto

| Proveedor | Modelo default | Motivo |
|-----------|----------------|--------|
| Ollama | `llama3.2-vision:11b` | Ya probado en producción |
| OpenAI | `gpt-4o-mini` | Visión + texto, coste bajo |
| Anthropic | `claude-3-5-haiku-20241022` | Rápido y con visión |
| Google | `gemini-2.0-flash` | Multimodal, buen precio/latencia |

El operador puede sobreescribir con `*_MODEL` si necesita más calidad (p. ej. `gpt-4o`, `claude-3-5-sonnet-20241022`).

### Coste y privacidad

- **Ollama**: las imágenes no salen de la red local; coste de hardware/electricidad.
- **Cloud**: cada clasificación/revisión envía un JPEG ~512px al proveedor; implica coste por token y que las imágenes transitan por servidores del tercero. Documentar en README que el usuario debe aceptar las políticas del proveedor elegido.

### Timeouts

Mantener timeouts diferenciados: visión (clasificar, revisar, matching) ~120s; texto (parseo búsqueda) ~30s; generación de proyecto ~180s. Los proveedores cloud suelen responder más rápido que Ollama local; los timeouts pueden ajustarse por proveedor si hace falta.

### Migración gradual

1. Extraer `readPhotoAsJpegBase64` y crear `OllamaProvider` con el código actual.
2. Mover funciones de negocio a `ai/index.ts` usando `getLlmProvider()`.
3. Implementar adaptadores cloud uno a uno (recomendado: OpenAI → Anthropic → Google).
4. Reexportar desde `ollama.ts` con `@deprecated` un release; eliminar en US posterior.

### Relación con otras US

| US | Relación |
|----|----------|
| US-011 | Mensajes de error IA deben ser agnósticos al proveedor |
| US-014 | Sanitización de prompts aplica a todos los adaptadores |
| US-015 | `resolvePhotoPath` antes de leer imagen para cualquier proveedor |
| US-019 | Exportar parsers y testear contra implementación real |

---

## Fuera de alcance (v1)

- Página de **Ajustes** en la UI para introducir API key sin editar `.env` (follow-up: US-021b o extensión)
- Almacenamiento cifrado de API keys en SQLite
- Selección de proveedor distinto por operación (p. ej. Ollama para clasificar, OpenAI para proyectos)
- Streaming de respuestas al cliente
- Cálculo de coste estimado por operación
- Soporte de Azure OpenAI, AWS Bedrock u otros hosts compatibles
- Fine-tuning o modelos custom por usuario
- Fallback automático Ollama → cloud si Ollama falla
- Comparativa A/B de proveedores en la misma foto

---

## Ejemplo de configuración

### Ollama (actual, sin cambios)

```bash
AI_PROVIDER=ollama
OLLAMA_URL=http://192.168.1.135:11434
```

### OpenAI

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o   # opcional, más calidad
```

### Anthropic (Claude)

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Google (Gemini)

```bash
AI_PROVIDER=google
GOOGLE_AI_API_KEY=AIza...
```
