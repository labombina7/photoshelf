# US-095 — Evolución fotográfica: gráficas + análisis IA on demand

## Contexto

La vista `/insights` actual genera narrativas de texto mediante Ollama para cada mes/año.
El problema: llama3 no ve las fotos, los datos EXIF son insuficientes para inferir nada
personal, y el resultado son textos genéricos que podrían ser de cualquier fotógrafo.

Esta US reemplaza completamente esa vista por un enfoque inverso:
**primero los datos reales en gráficas, luego la IA comenta esos datos de forma puntual.**

---

## Qué construimos

### 1. Gráficas de evolución por año (datos puros, sin IA)

Cuatro gráficos de líneas, eje X = años, agrupados visualmente:

**Focales** — top 5 focales más usadas cada año (mm). Permite ver si el fotógrafo
migra de 50mm a 35mm, abandona el zoom, etc.

**Tags** — top 5 tags por año (frecuencia relativa, % sobre total de fotos del año).
Permite ver si "street" sube, "familia" baja, "viaje" aparece un año concreto.

**Géneros** — distribución de géneros por año (street, portrait, landscape, etc.).
Stacked bar o líneas según lo que quede más legible.

**Hora de disparo** — hora media de disparo por año. Permite ver si el fotógrafo
se vuelve más nocturno, si cambia su rutina, etc.

Cada gráfica incluye solo años con ≥ 10 fotos (filtrar ruido).
Excluir cámaras móviles (usar `mobileCameraExclusionSQL`).

### 2. Análisis IA on demand

Botón "Analizar mi evolución" visible cuando hay datos de ≥ 3 años.

Al pulsar, llama3 recibe una tabla estructurada con los datos de las gráficas:
```
Años analizados: 2018–2025
Focal más usada por año: 2018: 50mm, 2019: 50mm, 2020: 35mm, 2021: 35mm...
Tags más frecuentes por año: 2018: portrait(40%), street(20%)... 2024: street(55%)...
Géneros predominantes por año: ...
Hora media de disparo: 2018: 14:30, ..., 2024: 18:45
```

Prompt: análisis de evolución estilística en 3-4 párrafos, detectar tendencias,
hitos de cambio, con tono personal pero basado estrictamente en los datos.

El resultado se muestra debajo de las gráficas. Se guarda en BD para no recalcular
en cada visita (invalidar si cambia el año más reciente con datos).

---

## Lo que desaparece

- Toda la infraestructura de bootstrap (`style_analysis_bootstrap`, `style_profiles`)
- El worker de síntesis mensual/anual (`runMonthlySynthesis`, `runAnnualSynthesis`, etc.)
- Las queries de style-analysis relacionadas con perfiles narrativos
- Los ficheros `src/lib/style-analysis/bootstrap.ts`, `cycle.ts`, `prompts.ts`

Se mantiene la tabla `style_profiles` temporalmente hasta migrar, luego se elimina
en una migración limpia.

---

## Datos necesarios (nuevas queries en `src/lib/queries/insights.ts`)

```typescript
// Focales por año: { year, focal_length, count }[]
getFocalEvolution(): FocalByYear[]

// Tags por año: { year, tag, count, percent }[] (top 5 por año)
getTagEvolution(): TagByYear[]

// Géneros por año: { year, genre, count, percent }[]
getGenreEvolution(): GenreByYear[]

// Hora media por año: { year, avg_hour }[]
getShootingHourEvolution(): HourByYear[]
```

Todo con `mobileCameraExclusionSQL` y filtro `year >= 1990`.

## Análisis IA guardado

Nueva tabla `evolution_analysis`:
```sql
CREATE TABLE IF NOT EXISTS evolution_analysis (
  id           INTEGER PRIMARY KEY,
  generated_at TEXT NOT NULL,
  data_hash    TEXT NOT NULL,  -- hash de los datos para invalidar si cambia
  analysis     TEXT NOT NULL   -- texto generado por llama3
);
```

Route `GET /api/insights/evolution` — devuelve datos de gráficas + análisis guardado si existe.
Route `POST /api/insights/evolution/analyze` — genera análisis IA y lo guarda.

---

## UI (`src/app/insights/page.tsx` y componentes)

- Sustituir el contenido actual de `/insights` completamente
- Navegador de años existente (US-094) se mantiene si tiene sentido, si no se elimina
- Gráficas: usar `<canvas>` con Chart.js o SVG manual (no hay librería de gráficas instalada — decidir)
- Botón "Analizar mi evolución" con estado de carga, resultado expandible
- Si Ollama no disponible: botón deshabilitado con tooltip "Ollama no disponible"

---

## Criterios de aceptación

- [ ] Las 4 gráficas se renderizan con datos reales del catálogo
- [ ] Los años sin datos (< 10 fotos) no aparecen en las gráficas
- [ ] Las cámaras móviles están excluidas de los datos
- [ ] El botón de análisis IA funciona y guarda el resultado
- [ ] El análisis guardado se muestra sin regenerar en visitas sucesivas
- [ ] Si no hay ≥ 3 años con datos, el botón no aparece
- [ ] La vista anterior (perfiles narrativos mensuales) desaparece completamente

---

## Notas de implementación

- Para las gráficas, evaluar si instalar Chart.js (ligero, ~60kb) o hacer SVG inline
  dado que son gráficas simples de líneas. Decidir en implementación.
- El análisis IA tarda 30-60s en generarse — usar streaming o polling simple
- La tabla `style_analysis_bootstrap` y `style_profiles` se pueden dejar en BD
  por compatibilidad hasta una US de limpieza posterior
