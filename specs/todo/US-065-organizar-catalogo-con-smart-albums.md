# Feature: Organización automática de catálogos no estructurados via smart albums

## Historia de usuario

Como fotógrafo con un catálogo de fotos sin estructura coherente (ej. backup automático del móvil con carpetas `01/`, `02/`...),
quiero que photoshelf detecte que el catálogo no está organizado y me ofrezca generar smart albums automáticamente a partir de los metadatos EXIF,
para poder navegar y encontrar mis fotos sin tener que reorganizar el filesystem.

---

## Descripción

Algunos catálogos no pueden (ni deben) reorganizarse físicamente — por ejemplo, un directorio que gestiona un NAS como backup del carrete del móvil con carpetas numeradas. Photoshelf detecta automáticamente si un catálogo recién añadido carece de estructura `AÑO/EVENTO/` y ofrece organizarlo mediante smart albums generados a partir de los datos EXIF ya indexados.

El flujo es:
1. El usuario añade o abre un catálogo no estructurado
2. Photoshelf detecta la estructura y muestra un banner: "Este catálogo no tiene estructura de eventos. ¿Quieres organizar las fotos en smart albums automáticamente?"
3. El sistema analiza los EXIF ya indexados y propone smart albums por clustering de fecha (y GPS si disponible)
4. El usuario revisa la propuesta, puede renombrar álbumes, y confirma
5. Los smart albums se crean en el catálogo — sin tocar el filesystem

---

## Criterios de aceptación

### Detección de catálogo no estructurado
- [ ] Al escanear un catálogo, el sistema evalúa si la estructura de carpetas sigue el patrón `AÑO/EVENTO/`
- [ ] Si menos del 50% de las carpetas raíz son años (4 dígitos entre 1900-2100), el catálogo se marca como "no estructurado"
- [ ] En la vista del catálogo no estructurado aparece un banner persistente con el botón "Organizar con smart albums"
- [ ] El banner solo desaparece si el usuario genera los álbumes o lo descarta explícitamente

### Propuesta de smart albums
- [ ] Al pulsar el botón, el sistema usa los datos EXIF ya indexados en BD (sin re-leer ficheros)
- [ ] El clustering agrupa fotos por proximidad temporal: gap de más de 3 días entre fotos = nuevo álbum
- [ ] Cada cluster propone un nombre basado en fecha: `Enero 2026`, `Semana Santa 2025`, etc.
- [ ] Si las fotos tienen GPS y hay clusters geográficos claros, se incluye el lugar en el nombre sugerido: `Enero 2026 · Roma`
- [ ] La propuesta se muestra como lista editable: nombre del álbum, rango de fechas, número de fotos
- [ ] El usuario puede renombrar cada álbum propuesto antes de confirmar
- [ ] El usuario puede fusionar o eliminar álbumes propuestos antes de confirmar

### Creación de smart albums
- [ ] Al confirmar, se crean smart albums con reglas de tipo `date_range` (y opcionalmente `location`) para el catálogo en cuestión
- [ ] Los smart albums generados quedan marcados con `source: auto` para distinguirlos de los creados manualmente
- [ ] Si el usuario ya tiene smart albums en ese catálogo, los generados automáticamente no los sobreescriben
- [ ] Una vez generados, el catálogo pasa a mostrarse organizado por álbumes en la vista principal

### Seguridad y reversibilidad
- [ ] No se modifica ningún fichero del filesystem en ningún momento
- [ ] Los smart albums generados pueden eliminarse individualmente o todos a la vez ("Deshacer organización automática")

---

## API necesaria

### `POST /api/catalogs/[id]/analyze-structure`
Evalúa si el catálogo tiene estructura `AÑO/EVENTO/` usando los datos ya en BD.
Devuelve `{ structured: boolean, folders: string[], unstructuredRatio: number }`.

### `POST /api/catalogs/[id]/suggest-albums`
Genera la propuesta de smart albums por clustering EXIF desde BD.
Devuelve lista de clusters: `{ name, dateFrom, dateTo, photoCount, locationHint? }[]`.

### `POST /api/catalogs/[id]/auto-organize`
Recibe la propuesta confirmada (con nombres editados) y crea los smart albums.
```json
{ "albums": [{ "name": "Reyes 2026", "dateFrom": "2026-01-05", "dateTo": "2026-01-07" }] }
```

---

## Ruta y navegación

- El banner aparece en la vista del catálogo: `/catalogs/[id]`
- El flujo de revisión/confirmación es un modal o página `/catalogs/[id]/organize`
- Accesible también desde ajustes del catálogo

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/UnstructuredCatalogBanner.tsx` | Banner con CTA "Organizar con smart albums" |
| `src/app/catalogs/[id]/organize/page.tsx` | Vista de revisión de propuesta (lista editable) |
| `src/app/api/catalogs/[id]/analyze-structure/route.ts` | Detección de estructura |
| `src/app/api/catalogs/[id]/suggest-albums/route.ts` | Propuesta de clustering |
| `src/app/api/catalogs/[id]/auto-organize/route.ts` | Creación de smart albums |
| `src/lib/catalogStructureAnalyzer.ts` | Lógica de detección de estructura |
| `src/lib/albumClusterizer.ts` | Lógica de clustering temporal/geográfico desde BD |

---

## Notas técnicas

- El clustering usa solo datos ya en BD (`taken_at`, `latitude`, `longitude`) — no re-lee ficheros EXIF
- Algoritmo de clustering temporal: ordenar fotos por `taken_at`, crear nuevo cluster cuando el gap entre fotos consecutivas supera 3 días (umbral configurable)
- Para el nombre sugerido: si el cluster cae en fechas conocidas (Navidad, Semana Santa, verano) usar ese nombre; si no, usar `Mes Año`
- Los smart albums generados usan reglas `date_range` existentes — no se necesita nuevo tipo de regla
- El campo `source` se añade a la tabla `smart_albums`: `'manual' | 'auto'`

---

## Fuera de alcance (v1)

- Reorganización física del filesystem (descartada — ver decisión de diseño)
- Importar desde servicios en la nube (Google Photos, iCloud, Dropbox)
- Detección de duplicados entre catálogos
- Clustering por personas (cara recognition)
- Umbral de clustering configurable por el usuario en la UI
