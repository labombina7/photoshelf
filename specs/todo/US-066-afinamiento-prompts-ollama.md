# Feature: Afinamiento de prompts de Ollama

## Historia de usuario

Como fotógrafo que usa las funciones de IA (clasificación, búsqueda, proyectos, revisión técnica),
quiero que cada prompt que envía la app a Ollama esté diseñado con intención y probado contra casos reales,
para que los resultados sean más fiables, consistentes y fáciles de depurar cuando fallen.

---

## Descripción

La app tiene cinco funciones que llaman a Ollama, cada una con su propio prompt escrito ad-hoc durante la implementación. Ninguno ha pasado por un proceso de evaluación sistemática: se probaron manualmente en el momento de escribirlos, pero no hay casos de test, no hay documentación de sus fallos conocidos y no hay criterio explícito de éxito.

Los síntomas actuales:
- `classifyPhoto` a veces devuelve tags en un orden distinto al esperado, omite el campo de género o genera más de 6 tags.
- `parseSearchQuery` sobregenera tags cuando la query es ambigua ("fotos bonitas" → añade estilos que el usuario no pidió).
- `generateProject` no siempre respeta las constraints duras de tone/tags, especialmente con colecciones pequeñas.
- `reviewPhoto` responde bien pero a veces el JSON tiene newlines literales dentro de valores de string, lo que fuerza el triple-fallback de parseo.
- `photoMatchesConcept` es demasiado binario: un concepto parcialmente presente en la foto se rechaza con NO aunque debería ser un match débil.

Esta US sistematiza el proceso: documenta el contrato de cada prompt, identifica sus puntos de fallo y aplica mejoras de prompt engineering contrastadas.

---

## Criterios de aceptación

### Inventario y documentación de prompts
- [ ] Cada función en `src/lib/ollama.ts` tiene un comentario de bloque que describe: input esperado, output esperado, taxonomía de tags permitidos (si aplica), y limitaciones conocidas
- [ ] Se crea `docs/tecnico/08-prompts-ollama.md` con la ficha completa de cada prompt: propósito, estructura, ejemplos de output válido e inválido, y el historial de cambios relevantes

### Script de evaluación manual
- [ ] Se crea `scripts/eval-prompts.ts` (ejecutable con `npx tsx scripts/eval-prompts.ts`) que:
  - Toma una carpeta de fotos de muestra o IDs específicos como argumento
  - Ejecuta los 5 prompts contra esas fotos
  - Imprime el output real junto al output esperado (definido en el script)
  - Muestra un resumen: N/total prompts que pasaron las comprobaciones básicas (formato JSON válido, nº de campos presentes, tags dentro de la taxonomía)
- [ ] El script **no** requiere cambios en el código de producción — es solo una herramienta de dev

### Mejoras a `classifyPhoto`
- [ ] El prompt indica explícitamente que los 6 tags son un máximo estricto, no un objetivo
- [ ] El prompt especifica que si la foto es en blanco y negro, el primer tag SIEMPRE debe ser "b&w"
- [ ] El prompt incluye un ejemplo negativo: qué NO hacer ("No escribas: 'Here are the tags:'")
- [ ] Tasa de JSON/formato válido ≥ 95% en el script de evaluación sobre 20 fotos de muestra

### Mejoras a `parseSearchQuery`
- [ ] El prompt añade la instrucción explícita: "If the query doesn't mention a specific style or genre, leave 'tags' as an empty array"
- [ ] Se añaden 2 ejemplos de over-tagging a evitar: `"fotos bonitas" → {"tags": []}`, `"mis mejores fotos" → {"tags": []}`
- [ ] El prompt usa `<system>` / `<user>` si el modelo lo soporta, o al menos separa claramente la instrucción del input de usuario

### Mejoras a `generateProject`
- [ ] El bloque de hard constraints se mueve al principio del prompt (antes de cualquier descripción de tarea) para evitar que el modelo lo olvide por dilución contextual
- [ ] Se añade una instrucción de verificación al final: "Before outputting, verify: (1) count of selectedIds equals ${count}, (2) every ID in selectedIds appears in the photo list above, (3) tone constraint satisfied"
- [ ] El campo `statement` pasa de "2-3 sentences" a "exactly 2 sentences" para reducir variabilidad

### Mejoras a `reviewPhoto`
- [ ] El prompt incluye la instrucción: "Do not use line breaks inside string values. Each value must be a single continuous string"
- [ ] Con este cambio, el triple-fallback de parseo en el código puede reducirse a un único `JSON.parse` + fallback de `extractJsonObject`
- [ ] Se verifica en el script de evaluación que ≥ 18/20 respuestas son JSON válido sin fallback

### Mejoras a `photoMatchesConcept`
- [ ] Se añade un tercer valor de respuesta: `PARTIAL` (el concepto está presente pero no es el tema principal)
- [ ] La función devuelve `{ matches: boolean; partial: boolean; tags: string[] }` — `matches: true` para YES/PARTIAL, `partial: true` solo para PARTIAL
- [ ] Los callers de `photoMatchesConcept` pueden usar `partial` para mostrar resultados con menor relevancia en la búsqueda semántica
- [ ] Si el cambio de interfaz rompe callers existentes, se actualiza el tipo en `src/lib/types.ts`

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/ollama.ts` | Mejoras en los 5 prompts + simplificación del parseo de `reviewPhoto` |
| `src/lib/types.ts` | Actualizar tipo de retorno de `photoMatchesConcept` si se añade `partial` |
| `scripts/eval-prompts.ts` | Nuevo — script de evaluación manual |
| `docs/tecnico/08-prompts-ollama.md` | Nuevo — ficha técnica de cada prompt |

---

## Notas técnicas

- Los prompts de visión (`classifyPhoto`, `reviewPhoto`, `photoMatchesConcept`) usan el endpoint `/api/generate` con `images`. El campo `system` de Ollama no se usa actualmente — evaluar si añadirlo mejora la consistencia del formato.
- El modelo actual es `llama3.2-vision:11b`. Los prompts están optimizados para él; documentar si se hacen suposiciones específicas del modelo que rompan con otros.
- El timeout de `ollamaVision` (120s) y `ollamaText` (30s por defecto, 180s para `generateProject`) no se tocan en esta US — son parte de US-047.
- El script de evaluación puede correr offline si Ollama está disponible localmente; no necesita acceso a Internet.

---

## Fuera de alcance (v1)

- Fine-tuning del modelo con datos propios
- Sistema de A/B testing automatizado de prompts
- Métricas de calidad persistentes en la DB (eso lo cubre US-059)
- Cambio de modelo o de proveedor (eso lo cubre US-021)
