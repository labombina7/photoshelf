# Feature: Panel de Estadísticas

## Historia de usuario

Como fotógrafo que quiere entender sus hábitos y su biblioteca,
quiero ver estadísticas visuales sobre mis fotos, cámaras y patrones de uso,
para descubrir insights sobre cómo y cuándo fotografío más, y qué espacio ocupa mi colección.

---

## Descripción

Una página **"Estadísticas"** accesible desde el sidebar que presenta métricas agregadas calculadas directamente desde SQLite, sin procesado externo ni IA. Los datos necesarios ya existen en la base de datos: `taken_at`, `camera`, `size_bytes`, `width`, `height`, `gps_lat`, `is_favorite`, así como las relaciones con tags y temas.

La página se divide en secciones temáticas con gráficos ligeros renderizados en SVG puro o con una librería mínima (como **Recharts**, ya habitual en proyectos Next.js). Toda la data se calcula server-side y se pasa como props al componente cliente.

---

## Criterios de aceptación

### Sección: Resumen general
- [ ] Total de fotos en la biblioteca
- [ ] Espacio total ocupado (suma de `size_bytes` formateada en GB/MB)
- [ ] Rango de años cubierto (año mín — año máx)
- [ ] Número de eventos, tags únicos y temas
- [ ] Fotos con GPS / sin GPS
- [ ] Fotos favoritas y porcentaje sobre el total

### Sección: Actividad por año
- [ ] Gráfico de barras verticales: fotos por año
- [ ] El año con más fotos resaltado
- [ ] Al pulsar una barra navega a `/library?year=YYYY`

### Sección: Actividad por mes (del año actual o seleccionable)
- [ ] Heatmap de 12 meses: intensidad = nº de fotos ese mes
- [ ] O gráfico de barras horizontal por mes
- [ ] Selector de año para cambiar el año analizado

### Sección: Cámaras y equipamiento
- [ ] Top 5 cámaras más usadas (basado en campo `camera` del EXIF)
- [ ] Gráfico de tarta o barras horizontales con % de uso por cámara
- [ ] "Sin información de cámara": porcentaje de fotos sin EXIF de cámara

### Sección: Tags más frecuentes
- [ ] Top 20 tags con mayor número de fotos asociadas
- [ ] Diferencia visual entre tags manuales y de IA (usando la columna `source` de `photo_tags`)
- [ ] Al pulsar un tag navega a `/tags/[tag]`

### Sección: Distribución por hora del día
- [ ] Histograma de 24 barras (una por hora): fotos tomadas en esa franja
- [ ] Basado en `taken_at` — solo fotos con hora disponible
- [ ] Útil para ver si el usuario fotografía más al amanecer, mediodía, etc.

### Performance
- [ ] Toda la data se calcula en el server component con queries SQL aggregadas (no N+1)
- [ ] Tiempo de carga de página < 1 s (las queries SQLite son instantáneas sobre índices)
- [ ] La página no tiene polling ni auto-refresh; botón "Actualizar" recarga la página

---

## API necesaria

No requiere endpoints nuevos. El server component hace las queries directamente a SQLite y pasa los datos como props serializados al cliente.

Si en el futuro se quiere acceso programático, se puede exponer `GET /api/stats` con el mismo payload.

---

## Ruta y navegación

- Ruta: `/stats`
- Enlace en sidebar bajo una sección "Herramientas" (junto a "Duplicados" de US-003)
- Icono: `IconStats` (gráfico de barras)
- Activo cuando `pathname === '/stats'`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/stats/page.tsx` | Server component — ejecuta todas las queries y serializa props |
| `src/app/stats/StatsClient.tsx` | Client component — renderiza secciones y gráficos |
| `src/app/stats/charts/BarChart.tsx` | Componente reutilizable de gráfico de barras (SVG o Recharts) |
| `src/app/stats/charts/PieChart.tsx` | Componente reutilizable de tarta |
| `src/app/stats/charts/HeatmapMonths.tsx` | Heatmap de actividad mensual |
| `src/app/stats/charts/HourHistogram.tsx` | Histograma de hora del día |
| `src/components/Icons.tsx` | Añadir `IconStats` |
| `src/components/Sidebar.tsx` | Nuevo enlace "Estadísticas" y sección "Herramientas" |

---

## Notas técnicas

- Queries de ejemplo:

```sql
-- Fotos por año
SELECT year, COUNT(*) as count FROM photos GROUP BY year ORDER BY year;

-- Top cámaras
SELECT camera, COUNT(*) as count FROM photos WHERE camera IS NOT NULL GROUP BY camera ORDER BY count DESC LIMIT 5;

-- Distribución por hora
SELECT CAST(strftime('%H', taken_at) AS INTEGER) as hour, COUNT(*) as count
FROM photos WHERE taken_at IS NOT NULL GROUP BY hour ORDER BY hour;

-- Top tags
SELECT t.name, pt.source, COUNT(*) as count
FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
GROUP BY t.id, pt.source ORDER BY count DESC LIMIT 20;
```

- Si se usa Recharts, importarlo con `next/dynamic` + `ssr: false`
- Los datos se pasan desde el server component como un único objeto `StatsData` tipado, evitando múltiples fetch desde el cliente
- Para el selector de año del heatmap mensual, se usa `useSearchParams` y un `<select>` con `router.push`

---

## Fuera de alcance (v1)

- Comparativa entre años (año actual vs anterior)
- Estadísticas de exposición/ISO/apertura (requeriría ampliar el escaneo EXIF)
- Mapa de calor geográfico (eso corresponde a US-002)
- Exportar estadísticas como PDF o CSV
- Notificaciones o alertas ("llevas 3 meses sin escanear")
