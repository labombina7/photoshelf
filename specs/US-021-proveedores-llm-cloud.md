# Feature: Soporte de proveedores LLM cloud — OpenAI Vision y Anthropic Claude

## Historia de usuario

Como fotógrafo que usa photoshelf en un contexto donde Ollama no está disponible,
quiero poder configurar un proveedor de IA en la nube (OpenAI, Anthropic) como alternativa,
para seguir clasificando y buscando fotos con IA aunque no tenga Ollama corriendo localmente.

---

## Descripción

La app depende en exclusiva de Ollama local para tres funciones de IA:
clasificación de fotos (`classifyPhoto`), búsqueda semántica (`parseSearchQuery`)
y revisión de foto (`reviewPhoto`). Si Ollama no está disponible, estas funciones
fallan completamente.

Esta US desacopla la implementación de IA de Ollama e introduce un sistema de
proveedores intercambiables. El proveedor activo se configura con una variable de
entorno (`AI_PROVIDER`). Se implementan adaptadores para OpenAI GPT-4o y Anthropic
Claude 3.5 Sonnet, además del adaptador Ollama existente.

---

## Criterios de aceptación

### Sistema de proveedores
- [ ] Existe una interfaz `AIProvider` en `src/lib/ai/provider.ts` con los métodos:
  - `generateText(prompt: string, options?): Promise<string>`
  - `generateVision(prompt: string, base64: string, options?): Promise<string>`
- [ ] La variable de entorno `AI_PROVIDER` acepta: `ollama` (default), `openai`, `anthropic`
- [ ] Si `AI_PROVIDER` es `openai` o `anthropic` y falta la API key correspondiente, el servidor
  lanza un error claro al arrancar

### Adaptador Ollama (refactorizado)
- [ ] El código existente de `src/lib/ollama.ts` se mueve a `src/lib/ai/adapters/ollama.ts`
  implementando la interfaz `AIProvider`
- [ ] El comportamiento es idéntico al actual

### Adaptador OpenAI
- [ ] `src/lib/ai/adapters/openai.ts` implementa `AIProvider` usando `openai` SDK
- [ ] Usa el modelo `gpt-4o` para visión y `gpt-4o-mini` para texto
- [ ] Los prompts son los mismos que los de Ollama (portabilidad)

### Adaptador Anthropic
- [ ] `src/lib/ai/adapters/anthropic.ts` implementa `AIProvider` usando `@anthropic-ai/sdk`
- [ ] Usa `claude-3-5-sonnet-20241022` para visión y texto
- [ ] Los prompts son los mismos que los de Ollama

### Integración
- [ ] `src/lib/ai/index.ts` exporta la función `getAIProvider(): AIProvider` que lee `AI_PROVIDER`
  y devuelve el adaptador correcto
- [ ] Las funciones de `ollama.ts` (`classifyPhoto`, `parseSearchQuery`, `reviewPhoto`, `photoMatchesConcept`,
  `generateProject`) usan `getAIProvider()` en lugar de las funciones de fetch directas
- [ ] La interfaz de usuario no muestra cambios — sólo el proveedor cambia internamente

### Costes y límites
- [ ] La configuración por defecto de cada adaptador cloud incluye un timeout razonable (60s visión, 30s texto)
- [ ] Si el proveedor cloud devuelve un error de cuota o rate limit, se devuelve un error descriptivo

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/ai/provider.ts` | Interfaz `AIProvider` |
| `src/lib/ai/adapters/ollama.ts` | Adaptador Ollama (código existente refactorizado) |
| `src/lib/ai/adapters/openai.ts` | Nuevo — adaptador OpenAI |
| `src/lib/ai/adapters/anthropic.ts` | Nuevo — adaptador Anthropic |
| `src/lib/ai/index.ts` | Factory `getAIProvider()` |
| `src/lib/ollama.ts` | Refactorizar para usar `getAIProvider()` |
| `src/instrumentation.ts` | Validar API key del proveedor activo al arranque |

---

## Notas técnicas

- Añadir `openai` y `@anthropic-ai/sdk` a `package.json` como dependencias opcionales
  o usar dynamic imports para no penalizar el bundle si no se usan
- Los prompts de clasificación y búsqueda están en los adaptadores en español/inglés — se
  pueden reusar directamente ya que GPT-4o y Claude entienden ambos idiomas
- La visión con Anthropic usa `image/jpeg` base64 en el campo `content` de los mensajes

---

## Fuera de alcance (v1)

- UI para cambiar de proveedor desde la interfaz (sólo variables de entorno)
- Fallback automático a otro proveedor cuando el principal falla
- Soporte de Google Gemini, Mistral u otros proveedores
- Tracking de costes de API por foto procesada
