# Feature: Búsqueda y filtrado por atributos técnicos EXIF

## Historia de usuario

Como fotógrafo que quiere entender y mejorar su técnica,
quiero poder filtrar mi biblioteca por parámetros técnicos como apertura, ISO, velocidad de obturación o focal,
para estudiar qué configuraciones uso más, encontrar mis mejores fotos en condiciones específicas, y aprender de mis patrones de disparo.

---

## Descripción

La biblioteca de photoshelf permite filtrar por año, evento, tag y favoritos — pero nada de esto habla sobre los datos técnicos que son el lenguaje propio de un fotógrafo: "¿cuáles son mis mejores fotos a ISO 3200?", "¿qué fotos disparé con el 50mm?", "¿tengo fotos a f/1.4?".

Estos datos ya están en la base de datos (extraídos del EXIF durante el scan) pero no son accesibles como filtros. Esta US los expone como un nuevo bloque de filtros técnicos en el sidebar y en la búsqueda, con rangos configurables y selección múltiple.

Los filtros técnicos tienen dos casos de uso distintos: el aprendizaje activo ("quiero ver cómo me quedan las fotos a ISO alto para decidir si compro un cuerpo nuevo") y la curaduría creativa ("busco fotos con bokeh pronunciado — apertura ≤ f/2.8 — para un portfolio").

---

## Criterios de aceptación

### Filtros disponibles
- [ ] **ISO**: rangos predefinidos: ≤400, 401–1600, 1601–6400, ≥6401; o input de rango libre
- [ ] **Apertura** (f-stop): ≤f/2, f/2.8, f/4, f/5.6–f/8, ≥f/11
- [ ] **Velocidad de obturación**: ≤1/500s, 1/100–1/500s, 1/30–1/100s, ≥1/30s (fotos con posible movimiento)
- [ ] **Focal (mm)**: categorías: gran angular (≤28mm), normal (35–50mm), retrato (85mm), tele (≥100mm); o rango libre
- [ ] **Cámara/objetivo**: selector de los equipos presentes en la biblioteca (ya guardados en `camera` field)

### Integración en la UI
- [ ] Los filtros técnicos se añaden como un nuevo bloque colapsable "Técnico" en el sidebar, debajo de los filtros existentes
- [ ] Los filtros técnicos son combinables con todos los filtros existentes (año, evento, tag, favorito)
- [ ] Al aplicar un filtro técnico, la URL incluye los parámetros: `?iso_max=400&aperture_max=2.8`
- [ ] Los filtros activos se muestran como chips en la topbar (igual que los otros filtros)

### Integración en la búsqueda
- [ ] La barra de búsqueda reconoce queries tipo "f/1.8" o "ISO 3200" o "50mm" y las redirige al filtro técnico correspondiente
- [ ] Esto se añade como nueva intención al clasificador de búsqueda: `exif` → activa los filtros técnicos

### Estadísticas técnicas
- [ ] En la página `/stats`, nueva sección "Perfil técnico":
  - Distribución de ISOs usados (gráfico de barras)
  - Aperturas más frecuentes (top 5)
  - Focales más usadas (distribución)
  - Porcentaje de fotos "seguras" (velocidad ≥ 1/focal)

---

## API necesaria

### `GET /api/photos` (modificado)
Nuevos parámetros opcionales: `iso_min`, `iso_max`, `aperture_min`, `aperture_max`, `shutter_min`, `shutter_max`, `focal_min`, `focal_max`, `camera`.

### `GET /api/stats/technical`
Distribuciones de ISO, apertura, focal y velocidad.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Sidebar.tsx` | Bloque colapsable "Técnico" con filtros EXIF |
| `src/components/ExifFilters.tsx` | Nuevo — componente de filtros técnicos con rangos |
| `src/lib/queries/photos.ts` | Añadir condiciones EXIF a `buildPhotoFilter` |
| `src/lib/search/classify.ts` | Reconocer intención `exif` en la búsqueda |
| `src/app/api/stats/technical/route.ts` | Nuevo — distribuciones técnicas |
| `src/app/stats/page.tsx` | Añadir sección "Perfil técnico" |

---

## Notas técnicas

- Los campos EXIF relevantes en la DB: `iso INTEGER`, `aperture REAL`, `shutter_speed TEXT`, `focal_length REAL` — verificar que scanner.ts los extrae correctamente; si alguno no está, añadirlo.
- La velocidad de obturación se almacena típicamente como fracción string ("1/500") — para filtrar numéricamente, añadir una columna calculada `shutter_speed_seconds REAL` durante el scan: `eval("1/500") = 0.002`.
- Los filtros EXIF en el SQL usan `BETWEEN :min AND :max` con los valores almacenados — eficiente con índice en `iso` y `aperture`.

---

## Fuera de alcance (v1)

- Filtro por objetivo/lens (requiere campo `lens_model` del EXIF, no siempre presente)
- Histograma de exposición de las fotos filtradas
- Sugerencias de configuración basadas en los patrones de disparo del usuario
- Comparativa de métricas entre dos períodos de tiempo
