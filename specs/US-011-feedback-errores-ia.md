# Feature: Feedback de errores de IA y estado del clasificador

## Historia de usuario

Como fotógrafo que usa la clasificación automática con IA,
quiero recibir feedback claro cuando el proceso falla o Ollama no está disponible,
para saber si mis fotos se clasificaron correctamente o si necesito revisar el estado del sistema.

---

## Descripción

Actualmente el flujo de clasificación puede fallar en silencio: si Ollama no está corriendo,
si el modelo no está descargado o si hay un timeout, el escáner continúa sin tags y el usuario
no recibe ninguna indicación. Esto provoca que fotos aparezcan sin etiquetar sin explicación.

Esta US añade tres mejoras:
1. **Toast de error** cuando la clasificación de un lote falla completamente
2. **Indicador de conexión Ollama** en la UI de configuración/escaneo (verde/rojo/amarillo)
3. **Reintento manual** de clasificación para fotos sin tags

---

## Criterios de aceptación

### Detección y notificación de fallos
- [ ] Si el endpoint de escaneo (`/api/scan`) recibe errores de Ollama en más del 50% de las fotos procesadas,
  devuelve un campo `warnings: string[]` en la respuesta con el motivo
- [ ] El cliente muestra un toast de tipo `warning` (amarillo) con el mensaje del warning, que persiste
  hasta que el usuario lo cierra (no auto-dismiss)
- [ ] Si Ollama devuelve error HTTP 5xx o la petición supera el timeout (30 s en classify), el error
  se loguea en `console.error` con el path de la foto afectada

### Indicador de estado Ollama
- [ ] En la página de configuración o panel de escaneo, existe un badge que muestra:
  - 🟢 **Disponible** — Ollama responde en `/api/ollama/status`
  - 🔴 **No disponible** — Ollama no responde o devuelve error
  - 🟡 **Verificando…** — estado inicial o mientras se consulta
- [ ] El badge actualiza su estado cuando el usuario abre la página (no polling continuo)
- [ ] Se crea el endpoint `GET /api/ollama/status` que hace ping a `${OLLAMA_URL}/api/tags`

### Reintento de clasificación
- [ ] En el DetailPanel de una foto sin tags, existe un botón "Clasificar foto" que llama a
  `/api/photos/{id}/classify` para relanzar la clasificación de esa foto individual
- [ ] Durante la clasificación muestra un spinner dentro del botón
- [ ] Al completar (éxito o error), muestra toast apropiado y actualiza los tags en la UI

### Sin cambios en la experiencia normal
- [ ] Cuando Ollama funciona correctamente, no aparece ningún indicador adicional en el flujo de escaneo
- [ ] El toast de error es informativo pero no bloquea la UI ni impide al usuario navegar

---

## API necesaria

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/ollama/status` | GET | Ping a Ollama, devuelve `{ available: boolean, model: string \| null }` |
| `/api/photos/[id]/classify` | POST | Reclasifica una foto individual, devuelve `{ tags: string[] }` |

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/ollama/status/route.ts` | Nuevo endpoint de ping |
| `src/app/api/photos/[id]/classify/route.ts` | Nuevo endpoint de reclasificación individual |
| `src/components/DetailPanel.tsx` | Botón "Clasificar foto" para fotos sin tags |
| `src/components/OllamaStatus.tsx` | Nuevo — badge de estado Ollama |
| `src/app/api/scan/route.ts` | Añadir campo `warnings` en respuesta |

---

## Notas técnicas

- El endpoint `/api/ollama/status` debe tener timeout corto (5 s) para no bloquear la UI
- La reclasificación individual reutiliza `classifyPhoto()` de `src/lib/ollama.ts`
- Si la foto ya tiene tags, el botón "Clasificar foto" debería aparecer como "Re-clasificar foto"

---

## Fuera de alcance (v1)

- Reintento en lote de todas las fotos sin tags
- Panel de logs de clasificación con histórico de errores
- Detección automática y descarga del modelo Ollama
