# Feature: Agrupación de fotos por persona con reconocimiento facial vía Ollama

## Historia de usuario

Como fotógrafo que tiene miles de fotos de familia,
quiero que la app identifique y agrupe automáticamente las fotos en las que aparece cada persona,
para poder encontrar rápidamente "todas las fotos donde sale mi hijo" sin etiquetar manualmente cada una.

---

## Descripción

La búsqueda por personas es una de las funcionalidades más valoradas en apps como Google Photos o Apple Photos, y actualmente no existe en photoshelf. La idea es aprovechar los modelos vision de Ollama (LLaVA, Gemma3) para detectar y describir personas en las fotos durante el proceso de clasificación, y almacenar esa información como tags especiales con el prefijo `persona:`.

El flujo propuesto: cuando se clasifica una foto, el prompt de visión incluye una instrucción para identificar si hay personas visibles y describirlas de forma consistente (ej. "persona con pelo corto castaño y gafas"). En una segunda fase, el usuario puede "nombrar" esos descriptores para asociarlos a personas reales de su familia.

Esta approach no requiere entrenamiento de modelos ni embeddings de caras — usa la capacidad de descripción visual de LLaVA para generar descriptores textuales consistentes que luego se pueden buscar.

---

## Criterios de aceptación

### Clasificación con detección de personas
- [ ] El prompt de clasificación de fotos incluye una instrucción para identificar personas visibles: número aproximado, características descriptivas
- [ ] Si se detectan personas, se generan tags con prefijo `persona:` (ej. `persona:adulto-pelo-castaño`, `persona:niño-pelo-rubio`)
- [ ] Los tags de persona se almacenan con `source: 'ai'` en la tabla `photo_tags`
- [ ] La detección de personas es opcional — si el modelo no soporta la capacidad o Ollama no está disponible, se omite sin error

### Vista de personas
- [ ] Existe una nueva sección "Personas" en el sidebar de navegación
- [ ] La vista de personas muestra un grid de tarjetas, una por descriptor de persona detectado
- [ ] Cada tarjeta muestra: el descriptor textual, una foto de ejemplo y el número de fotos
- [ ] Haciendo click en una tarjeta se filtra la biblioteca por esa persona (equivalente a buscar por el tag `persona:X`)

### Nombrar personas
- [ ] El usuario puede asignar un nombre propio a un descriptor (ej. renombrar `persona:niño-pelo-rubio` como "Lucas")
- [ ] El nombre se almacena como alias del tag en la base de datos o como un campo en la tabla `themes`
- [ ] Una vez nombrada, la persona aparece con su nombre en el sidebar y en el detalle de foto

### Búsqueda por persona
- [ ] La búsqueda unificada del header permite buscar por nombre de persona: "Lucas" → fotos con tag `persona:*` aliasado a "Lucas"
- [ ] En el detalle de foto, los tags de persona aparecen con el nombre asignado si lo tienen

---

## API necesaria

| Endpoint | Método | Descripción |
|---|---|---|
| `GET /api/persons` | GET | Lista de personas detectadas (tags con prefijo `persona:`) |
| `PATCH /api/persons/[tagId]` | PATCH | Asignar nombre a un descriptor de persona |

---

## Ruta y navegación

- Nueva sección: `src/app/persons/page.tsx`
- Añadir "Personas" al sidebar entre "Etiquetas" y "Temáticas"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/persons/page.tsx` | Nuevo — vista de personas |
| `src/app/persons/PersonsClient.tsx` | Nuevo — grid de personas con buscador |
| `src/app/api/persons/route.ts` | Nuevo — lista de personas |
| `src/app/api/persons/[tagId]/route.ts` | Nuevo — renombrar persona |
| `src/lib/ollama/classify.ts` | Ampliar prompt de clasificación para detectar personas |
| `src/components/Sidebar.tsx` | Añadir enlace a "Personas" |

---

## Notas técnicas

- Los modelos vision de Ollama (LLaVA 7B+, Gemma3) ya están soportados por la integración existente en `ollama.ts` — solo hay que ampliar el prompt
- Los descriptores generados por LLaVA no son embeddings de caras reales — no hay reconocimiento biométrico. Son descripciones textuales que pueden variar entre fotos de la misma persona. Esta limitación debe estar clara en la UI.
- El prefijo `persona:` en los tags es una convención — los tags se almacenan en la tabla `tags` existente sin cambios de esquema
- Para el alias de nombres, la opción más simple es una nueva columna `alias TEXT` en la tabla `tags` o una tabla `tag_aliases` separada

---

## Fuera de alcance (v1)

- Reconocimiento facial real con embeddings (requiere modelos especializados y hardware potente)
- Agrupación automática de fotos de la misma persona sin intervención del usuario
- Privacidad/anonimización de datos de personas (GDPR)
- Sincronización con contactos del dispositivo
