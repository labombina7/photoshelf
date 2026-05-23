# Feature: Feedback de errores en operaciones IA

## Historia de usuario

Como fotógrafo que clasifica y analiza fotos con IA,
quiero recibir un mensaje claro cuando una operación IA falla (Ollama no disponible, timeout, error de red),
para saber que necesito actuar y no quedarme esperando sin feedback.

---

## Descripción

Actualmente tres flujos IA terminan en silencio cuando fallan: la clasificación individual en `DetailPanel`, la clasificación en lote en `PhotoGrid`, y el guardado de tema en `AISearchPanel`. En los tres casos hay un bloque `catch` que descarta el error sin mostrar nada al usuario. El botón vuelve a su estado inicial y el usuario no sabe si la operación no tuvo efecto o si simplemente tardó más.

Esto es especialmente problemático porque Ollama es un servicio externo que puede estar detenido, sobrecargado o mal configurado. El patrón correcto ya existe en el codebase: `DetailPanel.requestReview()` usa un estado `reviewError` que muestra un mensaje contextual. Esta US extiende ese patrón a los tres puntos ciegos restantes.

El feedback debe ser proporcionado: un mensaje en el mismo panel donde ocurrió la acción (no un toast global genérico), con la opción de reintentar si aplica.

---

## Criterios de aceptación

### Clasificación individual — DetailPanel
- [ ] La función `classify()` en `DetailPanel.tsx` captura el error en `catch (err)` en lugar de `catch {}`
- [ ] Al producirse el error, se muestra un mensaje en el panel: `"No se pudo clasificar. Verifica que Ollama esté disponible."` usando el estado `classifyError` (nuevo) o reutilizando `reviewError`
- [ ] El mensaje de error incluye un botón "Reintentar" que vuelve a invocar `classify()`
- [ ] El botón "Clasificar" vuelve a su estado normal (no queda en estado loading) al producirse el error

### Clasificación en lote — PhotoGrid
- [ ] La función `handleClassify()` en `PhotoGrid.tsx` tiene try/catch explícito alrededor del fetch a `/api/ai/classify/batch`
- [ ] Al producirse un error, se muestra un mensaje en el área de resultados de la barra de herramientas: `"Error en clasificación en lote. Comprueba Ollama e inténtalo de nuevo."`
- [ ] El estado `classifying` vuelve a `false` tanto en éxito como en error (el `finally` ya existe; añadir el estado de error)

### Guardado de tema — AISearchPanel
- [ ] La función `saveTheme()` en `AISearchPanel.tsx` tiene try/catch alrededor del `Promise.all` de los múltiples fetch
- [ ] Al producirse un error en cualquiera de las peticiones, se muestra un mensaje: `"No se pudo guardar el tema. Inténtalo de nuevo."`
- [ ] El estado `saving` vuelve a `false` al producirse el error

### Coherencia visual
- [ ] Los mensajes de error usan el mismo estilo visual que el `review-error` ya existente en `DetailPanel`
- [ ] Los errores desaparecen al volver a intentar la operación (se limpian al inicio de cada retry)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/DetailPanel.tsx` | Añadir `classifyError` state; capturar error en `classify()` |
| `src/components/PhotoGrid.tsx` | Añadir try/catch y estado de error en `handleClassify()` |
| `src/components/AISearchPanel.tsx` | Añadir try/catch y estado de error en `saveTheme()` |

---

## Notas técnicas

- En `DetailPanel`, el estado `reviewError` ya existe y maneja un string de error + un boolean de carga. Crear un `classifyError` análogo es el cambio mínimo; alternativamente, si se quiere unificar, el mismo estado podría gestionar ambos errores mutuamente excluyentes.
- Para `PhotoGrid`, el mensaje de error puede ser un `<div className="classify-error">` justo después del botón en la toolbar.
- El fetch a `/api/ai/classify/batch` puede fallar tanto por red (Ollama caído) como por timeout. El catch debe capturar ambos casos sin distinguir.
- No es necesario implementar retry automático; un botón manual es suficiente para v1.

---

## Fuera de alcance (v1)

- Retry automático con backoff exponencial
- Distinguir entre tipos de error (Ollama caído vs. error de parseo vs. timeout)
- Toast global de estado de Ollama (podría ser una feature separada)
- Indicador de disponibilidad de Ollama en la sidebar
