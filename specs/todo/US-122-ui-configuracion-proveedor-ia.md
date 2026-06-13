# Feature: UI de configuración de IA en settings — toggle, proveedor y validación

## Historia de usuario

Como usuario de photoshelf,
quiero configurar el proveedor de IA desde la pantalla de ajustes,
para elegir entre Ollama local o un proveedor cloud, introducir mi API key y verificar que la conexión funciona, todo sin tocar ficheros de configuración del servidor.

---

## Descripción

Implementa la sección `/settings/ai` que hoy muestra un placeholder "Próximamente". El usuario puede:
1. Activar o desactivar la IA globalmente
2. Seleccionar proveedor: Ollama (local) o Anthropic (cloud)
3. Configurar los parámetros del proveedor seleccionado
4. Testear la conexión antes de guardar

Se actualiza `AiSettingsClient.tsx`, que ahora está vacío, con el formulario completo.

---

## Criterios de aceptación

### Toggle global
- [ ] Toggle "Activar funcionalidades de IA" visible y funcional
- [ ] Al desactivar, el formulario de proveedor se oculta (sin borrar la config)
- [ ] El estado persiste via `PATCH /api/settings/ai`

### Selector de proveedor: Ollama
- [ ] Campos: URL (default `http://localhost:11434`), modelo visión, modelo texto
- [ ] Botón "Verificar conexión" que llama a `POST /api/settings/ai/test`
- [ ] Respuesta correcta: badge verde "Conectado · modelo X disponible"
- [ ] Respuesta incorrecta: error descriptivo ("Ollama no responde", "modelo llava no descargado")

### Selector de proveedor: Anthropic
- [ ] Campo API key con toggle mostrar/ocultar (tipo password)
- [ ] Selector de modelo: `claude-haiku-4-5` (recomendado) / `claude-sonnet-4-6`
- [ ] Botón "Validar API key"
- [ ] Key válida: badge verde "API key válida"
- [ ] Key inválida o sin saldo: error descriptivo

### Guardar
- [ ] Botón "Guardar" habilitado solo tras validar conexión/key
- [ ] Feedback de guardado exitoso (toast o mensaje inline)
- [ ] Los campos muestran la configuración actual al cargar la página

### Verificación
- [ ] Con Ollama activo y disponible: el badge muestra verde tras verificar
- [ ] Con key de Anthropic válida: el badge muestra verde
- [ ] Cambiar de proveedor y guardar refleja el cambio sin reiniciar la app

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/app/settings/ai/AiSettingsClient.tsx` | Reemplazar placeholder con el formulario completo |
| `src/app/api/settings/ai/test/route.ts` | `POST` — verifica conexión del proveedor activo |

---

## Notas técnicas

- El endpoint de test llama directamente al proveedor (Ollama o Anthropic) y devuelve `{ ok: boolean, error?: string, model?: string }`
- Para Ollama: `GET {url}/api/tags` y verificar que el modelo configurado está en la lista
- Para Anthropic: llamada mínima a la API con la key (ej. `messages.create` con `max_tokens: 1`)
- Ver diseño de pantalla completo en EPIC-007

---

## Dependencias

- **US-121** — tabla `ai_config` y API
- **EPIC-006** (settings reorganización) — ya desplegada, la ruta `/settings/ai` existe
- Parte de **EPIC-007**

## Fuera de alcance

- Otros providers (OpenAI, Google Gemini…)
- Historial de configuraciones anteriores
