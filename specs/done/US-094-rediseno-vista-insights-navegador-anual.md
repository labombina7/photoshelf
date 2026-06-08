# US-094 — Rediseño vista "Tu estilo": navegador anual e historial de evolución

> Estado: ✅ Desplegada (PR #166, 2026-06-07)

## Historia de usuario

Como fotógrafo que usa photoshelf,
quiero navegar por mi historia fotográfica año a año con flechas,
para leer la narrativa de cada año junto a mis estadísticas reales de ese período,
y ver cómo ha evolucionado mi estilo a lo largo del tiempo.

---

## Descripción

La vista actual (`/insights`) muestra listas de acordeones por mes y por año histórico — útil para almacenamiento pero no para lectura. Esta US rediseña completamente la presentación para priorizar la experiencia narrativa.

La nueva vista tiene dos bloques:

### 1. Navegador anual (bloque principal)

Un visor tipo "slide" donde el usuario navega año a año con flechas `←` / `→`. Cada año muestra:

- **Narrativa**: texto generado por Ollama sobre el estilo fotográfico del año
- **Estadísticas**: datos EXIF reales del año (sin medias, solo valores más usados)
- **Indicador de tendencia**: frase corta sobre hacia dónde evolucionó el estilo

### 2. Línea de evolución (bloque secundario)

Una vista compacta de todos los años disponibles, mostrando el `trend` de cada uno, para ver la evolución de un vistazo.

---

## Criterios de aceptación

### Navegador anual

- [ ] La página muestra el año más reciente al cargar
- [ ] Flechas `←` / `→` para navegar entre años; se deshabilitan en los extremos
- [ ] El año actual se indica con un badge "Este año"
- [ ] Animación suave al cambiar de año (fade o slide)
- [ ] Cada año muestra:
  - Título grande: el año (ej. "2023")
  - Narrativa en texto libre (3-4 párrafos)
  - Bloque de estadísticas (ver detalle abajo)
  - Frase de tendencia (`trend`)
- [ ] Si el año aún no tiene narrativa (Ollama pendiente), se muestra el bloque de estadísticas igualmente con placeholder de narrativa
- [ ] Si el año no tiene ningún dato, no aparece en el navegador

### Bloque de estadísticas por año

```
📷  Sony A7III                    (cámara más usada)
🔭  35mm · 50mm · 85mm            (focales más usadas)
⚡  f/1.4 · f/2.0 · f/2.8        (aperturas más usadas)
💡  ISO 100 · ISO 400             (ISOs más usados)
🕐  Tardes (16–19h)               (hora habitual — calculada de avgHourOfDay)
🎨  Street · Retrato              (géneros top)
📸  N fotos                       (volumen)
```

### Línea de evolución

- [ ] Debajo del navegador, una sección "Tu evolución" con todos los años en fila
- [ ] Cada año muestra: año, número de fotos, y el `trend` (frase corta)
- [ ] Al pulsar un año en la línea de evolución, el navegador salta a ese año
- [ ] El año actualmente visible en el navegador se resalta en la línea

### Fuente de datos por año

Los perfiles en BD están en dos formatos según su antigüedad:

| Período | Tipo en BD | Cómo se usa |
|---|---|---|
| Años históricos (>24 meses) | `annual_historical` | Directo — tiene narrativa + periodSummary |
| Años recientes (últimos 2 años) | Perfiles mensuales `monthly` | Se agregan en la API al vuelo |

Para años recientes, la API construye una vista anual combinando:
- **Narrativa**: del perfil mensual más reciente del año (o placeholder si ninguno tiene narrativa)
- **Estadísticas**: agregación de los `periodSummary` mensuales (top de tops)
- **Trend**: del perfil mensual más reciente con trend disponible

### Compatibilidad con datos existentes

- [ ] Los perfiles ya generados en BD se usan sin modificar el esquema
- [ ] El cambio es únicamente en la capa de presentación (API + UI)
- [ ] No se borra ni migra ningún dato de `style_profiles`

---

## API

### GET /api/insights/years

Devuelve todos los años con datos, ordenados de más reciente a más antiguo:

```typescript
[
  {
    year: 2024,
    isCurrent: true,
    photoCount: 312,
    narrative: string | null,
    highlights: string[],
    trend: string | null,
    stats: {
      topCamera: string | null,
      topFocalLengths: number[],
      topApertures: number[],
      topIsos: number[],
      avgHourOfDay: number | null,
      topGenres: string[],
    }
  },
  ...
]
```

---

## Archivos nuevos / modificados

| Archivo | Cambio |
|---|---|
| `src/app/api/insights/years/route.ts` | Nuevo endpoint GET |
| `src/app/insights/page.tsx` | Consume el nuevo endpoint |
| `src/app/insights/InsightsClient.tsx` | Rediseño completo — navegador anual |
| `src/app/insights/components/YearView.tsx` | Nuevo — vista de un año con narrativa + stats |
| `src/app/insights/components/StatsBlock.tsx` | Nuevo — bloque de estadísticas visuales |
| `src/app/insights/components/EvolutionLine.tsx` | Nuevo — línea de evolución horizontal |
| `src/app/globals.css` | Estilos del nuevo diseño |
| `src/app/insights/components/MonthProfile.tsx` | Puede eliminarse o mantenerse oculto |
| `src/app/insights/components/HistoryBlock.tsx` | Puede eliminarse o mantenerse oculto |
| `src/app/insights/components/RecentEvolutionBlock.tsx` | Puede eliminarse o mantenerse oculto |

---

## Diseño visual (referencia)

```
┌─────────────────────────────────────────────────────────┐
│  Tu estilo                                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ←          2023    [Este año]          →              │
│                                                          │
│  "2023 fue un año en el que primó tu visión de           │
│   street photography. A lo largo de estos meses         │
│   has explorado..."                                      │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │ 📷  Sony A7III                               │       │
│  │ 🔭  35mm · 50mm                              │       │
│  │ ⚡  f/1.4 · f/2.0 · f/2.8                   │       │
│  │ 💡  ISO 100 · ISO 400                        │       │
│  │ 🕐  Tardes (16–19h)                          │       │
│  │ 🎨  Street · Retrato · Arquitectura          │       │
│  │ 📸  847 fotos                                │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  → "Tu estilo viró hacia composiciones más minimalistas" │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Tu evolución                                            │
│                                                          │
│  2019      2020      2021      2022      2023      2024  │
│  Street    Retrato   Mixto     Paisaje   Street    ···   │
│  412f      623f      891f      734f      847f      312f  │
└─────────────────────────────────────────────────────────┘
```

---

## Fuera de alcance (v1)

- Comparativa directa entre dos años seleccionados
- Gráficas de evolución de focal/apertura a lo largo de los años
- Exportar el resumen anual como PDF o imagen
- Compartir el perfil de un año
