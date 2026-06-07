# US-074: Motor de análisis — extracción EXIF y selección de muestra

> **Épica padre:** [EPIC-004 — Análisis de estilo fotográfico](EPIC-004-analisis-estilo-fotografico.md)

> Estado: ✅ Desplegada

## Historia de usuario

Como sistema de análisis de estilo fotográfico,
quiero extraer los datos EXIF relevantes de cada foto y seleccionar muestras representativas por periodo,
para poder sintetizar el estilo del fotógrafo sin necesidad de procesar el catálogo entero de una vez.

---

## Descripción

Esta US es la base de datos de toda la épica. Construye dos capacidades:

1. **Extracción de señales de estilo por foto** — a partir del EXIF ya disponible en la BD, extrae y normaliza los campos relevantes para el análisis de estilo: focal, apertura, ISO, velocidad, hora del disparo, cámara y objetivo.

2. **Algoritmo de selección de muestra** — dado un conjunto de fotos (por mes, por año, por toda la colección histórica), selecciona una muestra representativa que maximice la variedad de escenas, géneros y condiciones. Esta muestra es la que se enviará a Ollama para la síntesis.

La extracción no llama a Ollama — es puro SQL + lógica de muestreo. Esta US no produce ningún insight visible para el usuario; es infraestructura que usan US-075 y US-076.

---

## Criterios de aceptación

### Extracción de señales EXIF

- [ ] Se crea `src/lib/queries/style-analysis.ts` con funciones de repositorio para el análisis de estilo — sin SQL inline en otros sitios
- [ ] `getPhotoStyleSignals(photoId)` devuelve un objeto tipado con: `focalLength`, `aperture`, `iso`, `shutterSpeed`, `capturedAt`, `camera` (marca + modelo), `lens`, `genre` (del tag IA si existe)
- [ ] `getStyleSignalsByPeriod({ from, to })` devuelve el agregado de señales para un rango de fechas: distribución de focales, apertura media, ISO medio, hora media de disparo, equipo más usado, géneros predominantes
- [ ] Los campos EXIF que no existen en una foto devuelven `null`, no error
- [ ] Se añade el tipo `StyleSignals` y `PeriodStyleSummary` a `src/lib/types.ts`

### Selección de muestra

- [ ] `selectRepresentativeSample({ from, to, maxPhotos: number })` devuelve un array de `photoId` que representa la variedad del periodo
- [ ] El algoritmo prioriza diversidad: no coge las N fotos más recientes sino que distribuye por género, hora del día y tipo de escena (usando tags IA existentes)
- [ ] Si el periodo tiene menos fotos que `maxPhotos`, devuelve todas sin error
- [ ] El tamaño por defecto de muestra es 50 fotos por mes, 30 por año (histórico)

### Cobertura temporal

- [ ] `getAnalysablePeriods()` devuelve la lista de meses y años que tienen fotos en el catálogo, con el número de fotos de cada periodo — para que el bootstrap sepa qué hay que procesar

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/queries/style-analysis.ts` | Nuevo — repositorio de extracción y muestreo |
| `src/lib/types.ts` | Añadir `StyleSignals`, `PeriodStyleSummary` |

---

## Notas técnicas

- Los datos EXIF ya están en la tabla `photos` (columnas `exif_*` o similar) — revisar el schema antes de implementar para no reextraer lo que ya está
- Los tags IA (género, mood, composición) están en la tabla `photo_tags` — el join es necesario para el muestreo por diversidad
- La selección de muestra debe ser determinista dado el mismo input (misma seed o criterio ordenado) para que el bootstrap sea reproducible si se reinicia
- No se crea ninguna tabla nueva en esta US — los resultados son efímeros y los usan las USes siguientes

---

## Fuera de alcance

- Llamadas a Ollama (eso es US-075 y US-076)
- Persistencia de perfiles o insights en BD (eso es US-076)
- UI de ningún tipo
