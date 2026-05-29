# Feature: Revisión y validación de tags generados por IA

## Historia de usuario

Como fotógrafo que usa la clasificación automática con IA,
quiero poder revisar los tags generados, confirmar los correctos y rechazar los erróneos en un flujo rápido,
para poder confiar en que los tags de mi biblioteca son fiables y no llenarme de etiquetas incorrectas.

---

## Descripción

El mayor freno a la adopción de IA en gestión fotográfica no es la ausencia de features — es la desconfianza. El usuario prueba el AI tagging, ve uno o dos errores evidentes, y decide que "la IA no sirve para esto". El problema no es la precisión del modelo, es la falta de un mecanismo para corregir y validar, que transforme la IA de "caja negra que puede equivocarse" en "asistente que aprendo a controlar".

Esta US añade dos capas de confianza:

1. **Indicador de confianza por tag**: cada tag generado por IA se almacena con un nivel de confianza (`high`, `medium`, `low`) que el sistema asigna heurísticamente. Los tags de baja confianza se marcan visualmente para llamar a revisión.

2. **Flujo de revisión de tags IA**: una vista dedicada donde el usuario puede revisar fotos con tags de baja confianza o sin revisar, y confirmar/rechazar cada tag con un click. Los tags confirmados por el usuario se marcan como `validated: true` y nunca vuelven a aparecer en la cola de revisión.

---

## Criterios de aceptación

### Indicadores de confianza en el detalle de foto
- [ ] Los tags con `source: 'ai'` muestran un indicador visual de confianza: check verde (high), punto gris (medium), interrogante ámbar (low)
- [ ] Al hacer hover sobre el indicador, se muestra un tooltip: "Tag generado por IA · confianza alta/media/baja"
- [ ] Los tags validados manualmente (confirmados por el usuario) muestran un check diferente: "Confirmado por ti"

### Flujo de revisión
- [ ] Nueva ruta `/tools/review-tags` accesible desde el sidebar
- [ ] La vista muestra fotos con tags IA no revisados, una por una (estilo "flashcard")
- [ ] Para cada foto: imagen + todos sus tags IA con sus indicadores de confianza
- [ ] Para cada tag, el usuario puede pulsar ✓ (confirmar) o ✗ (rechazar) — atajo de teclado: número de la posición del tag para confirmar, Shift+número para rechazar
- [ ] Al rechazar un tag, se elimina de la foto en la DB
- [ ] Al confirmar un tag, se marca como `validated: true`
- [ ] Tecla `→` o `Space`: avanzar a la siguiente foto sin tomar decisión sobre los tags restantes

### Filtros de la cola de revisión
- [ ] Mostrar solo fotos con tags de confianza `low` o `medium` (por defecto)
- [ ] Filtro adicional: "todas las fotos con tags IA" (incluyendo high confidence)
- [ ] Contador en el sidebar: "X fotos por revisar" (con badge numérico)

### Impacto en el modelo heurístico de confianza
- [ ] La confianza inicial se asigna en el momento de clasificación:
  - `high`: el modelo generó el tag con alta certeza (detectado en el texto de respuesta de Ollama si incluye indicadores de certeza)
  - `medium`: tag generado sin indicadores de certeza explícitos
  - `low`: tag que aparece solo una vez en la taxonomía, contradicción con otros tags de la foto, o tags de contenido ambiguo
- [ ] Esta lógica es mejorable iterativamente sin cambios de esquema

### Estadísticas de calidad IA
- [ ] En la página `/stats`, nueva sección "Calidad de IA": tags validados vs rechazados, tasa de aceptación por tipo de tag
- [ ] Esta data permite al usuario calibrar si Ollama funciona bien en su hardware

---

## API necesaria

### `GET /api/tags/review-queue`
Lista de fotos con tags IA pendientes de revisión.

```json
{ "photos": [{ "id": 42, "thumbnail": "...", "ai_tags": [{ "id": 10, "name": "retrato", "confidence": "low", "validated": false }] }], "total": 87 }
```

### `PATCH /api/photos/[id]/tags/[tagId]`
`{ "validated": true }` o `{ "rejected": true }` (rejected elimina el tag).

---

## Ruta y navegación

- Ruta: `/tools/review-tags`
- Badge numérico en el sidebar con el número de fotos pendientes de revisión

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/tools/review-tags/page.tsx` | Server component — carga cola inicial |
| `src/app/tools/review-tags/ReviewClient.tsx` | Client — flashcard, atajos de teclado |
| `src/app/api/tags/review-queue/route.ts` | Cola de revisión |
| `src/app/(library)/[year]/[event]/[photoId]/TagList.tsx` | Indicadores de confianza por tag |
| `src/lib/db.ts` | Añadir columnas `confidence TEXT` y `validated BOOLEAN` a `photo_tags` |
| `src/lib/ollama.ts` | Asignar confianza heurística en el momento de clasificación |
| `src/components/Sidebar.tsx` | Badge numérico en "Herramientas" o en "Etiquetas" |

---

## Notas técnicas

- Las columnas nuevas en `photo_tags`: `confidence TEXT CHECK(confidence IN ('high', 'medium', 'low')) DEFAULT 'medium'` y `validated INTEGER DEFAULT 0`.
- El nivel de confianza heurístico inicial: si la respuesta de Ollama incluye palabras como "definitely", "clearly", "obviously" → high; si incluye "might", "possibly", "could be" → low; resto → medium. Es una heurística aproximada que puede mejorarse.
- El badge numérico en el sidebar puede calcularse con una query `SELECT COUNT(DISTINCT photo_id) FROM photo_tags WHERE source = 'ai' AND validated = 0` — cacheable con TTL de 60s para no ejecutarla en cada render.

---

## Fuera de alcance (v1)

- Fine-tuning del modelo basado en las validaciones del usuario
- Sugerencias de tags alternativos cuando el usuario rechaza uno
- Revisión en lote (confirmar/rechazar el mismo tag en todas las fotos a la vez)
- Export del histórico de validaciones para análisis externo
