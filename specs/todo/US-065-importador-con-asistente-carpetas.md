# Feature: Importador con asistente de estructura de carpetas

## Historia de usuario

Como fotógrafo con fotos en carpetas desorganizadas o con estructura no compatible con photoshelf,
quiero que la app analice mis carpetas actuales y me ayude a reorganizarlas en la estructura `AÑO/EVENTO/` sin perder nada,
para poder empezar a usar photoshelf con mi biblioteca existente sin tener que reorganizar manualmente miles de archivos.

---

## Descripción

La barrera de entrada más grande de photoshelf es que requiere una estructura de carpetas específica: `AÑO/EVENTO/fotos`. La mayoría de fotógrafos amateurs que llevan años acumulando fotos no tienen esa estructura — tienen carpetas por fecha plana (`2023-06-15/`), carpetas con nombres de lugares (`Mallorca/`), carpetas anidadas sin coherencia, o todo mezclado en una sola carpeta.

El importador asistido analiza la estructura existente del directorio de fotos, propone una reorganización en el formato compatible, y ejecuta la migración con total seguridad (mueve archivos, nunca los borra; genera un log de movimientos para poder revertir si algo va mal).

El flujo es:
1. El usuario apunta al directorio con sus fotos actuales
2. El sistema analiza la estructura y propone un mapeo: "Esta carpeta `Vacaciones Grecia` parece ser del año 2019 por las fechas EXIF → propongo moverla a `2019/Vacaciones-Grecia/`"
3. El usuario revisa, ajusta si quiere, y confirma
4. El sistema ejecuta los movimientos y lanza el scan automáticamente

---

## Criterios de aceptación

### Análisis de la estructura actual
- [ ] El usuario puede introducir la ruta de un directorio fuente (diferente al directorio de fotos configurado)
- [ ] El sistema analiza recursivamente el directorio: detecta subdirectorios, cuenta fotos por carpeta, y lee EXIF de una muestra (máx 10 fotos por carpeta) para inferir el año
- [ ] Se identifican tres tipos de estructura encontrada:
  - `year/event/` — compatible, sin acción necesaria
  - `event/` sin año — propone inferir el año de las fechas EXIF
  - `flat` — todas las fotos en un mismo nivel, propone agrupar por mes/evento según fechas EXIF

### Propuesta de reorganización
- [ ] La propuesta se muestra como una tabla de mapeo: `Carpeta actual → Carpeta propuesta`
- [ ] El usuario puede editar el nombre del evento propuesto directamente en la tabla
- [ ] Carpetas con fotos de múltiples años se dividen automáticamente: `Fotos/` con fotos de 2019 y 2022 → `2019/Fotos-antiguas/` y `2022/Fotos/`
- [ ] Un contador muestra: "X archivos se moverán, Y carpetas se crearán"
- [ ] Opción "Previsualizar en árbol" muestra la estructura resultante antes de ejecutar

### Ejecución de la migración
- [ ] Botón "Reorganizar y escanear" lanza la migración
- [ ] La migración es un movimiento de archivos (no copia): `fs.rename` con fallback a copy+delete si el destino está en otro volumen
- [ ] Se genera un log de migración: `_migration_log_YYYYMMDD.json` en el directorio destino, con cada movimiento `{ from, to, timestamp }`
- [ ] Si un archivo destino ya existe, se renombra con sufijo `_2` en lugar de sobreescribirse
- [ ] Al completar la migración, se lanza automáticamente un scan de la biblioteca
- [ ] Si algo falla a mitad: el log permite identificar qué se movió para revertir manualmente

### Seguridad
- [ ] Nunca se permite que el directorio fuente y el destino se superpongan (para evitar loops)
- [ ] Se requiere confirmación explícita antes de ejecutar — pantalla de resumen con "Esta acción moverá X archivos. No se puede deshacer automáticamente."
- [ ] El log de migración es obligatorio y no puede desactivarse

---

## API necesaria

### `POST /api/importer/analyze`
```json
{ "source_path": "/Users/javi/Pictures" }
```
Devuelve el análisis de estructura y la propuesta de reorganización.

### `POST /api/importer/execute`
```json
{ "mappings": [{ "from": "/Users/javi/Pictures/Grecia", "to": "/photos/2019/Vacaciones-Grecia" }] }
```
Ejecuta la migración en background.

### `GET /api/importer/status`
Estado del proceso de migración en background.

---

## Ruta y navegación

- Ruta: `/tools/importer`
- Acceso: sidebar → "Herramientas" → "Importar fotos"
- También accesible desde el wizard (US-064) como misión "Importar fotos desde otro directorio"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/tools/importer/page.tsx` | Wizard de importación (4 pasos) |
| `src/app/tools/importer/ImporterClient.tsx` | Client — análisis, tabla de mapeo, ejecución |
| `src/app/api/importer/analyze/route.ts` | Análisis de estructura |
| `src/app/api/importer/execute/route.ts` | Ejecución de migración |
| `src/app/api/importer/status/route.ts` | Estado del proceso |
| `src/lib/importerAnalyzer.ts` | Lógica de análisis de estructura y propuesta |
| `src/lib/importerExecutor.ts` | Lógica de movimiento de archivos y generación de log |

---

## Notas técnicas

- El análisis de estructura usa `fs.readdir(recursive: true)` de Node 18+ o una implementación manual de traversal. Para directorios con > 10.000 archivos, limitar la muestra EXIF a 10 archivos por carpeta pero contar todos.
- La inferencia de año: leer `taken_at` del EXIF con `exifr.parse` en los archivos de muestra. Si el 80%+ de las fotos de una carpeta tienen el mismo año → usar ese año. Si hay mezcla → dividir por año.
- El movimiento de archivos usa `fs.rename` que es atómico en el mismo volumen. Para cross-volume: `fs.copyFile` + `fs.unlink` después de verificar que la copia fue exitosa (comparando size_bytes).
- El log JSON se escribe de forma append-only: cada movimiento se añade al log antes de ejecutarse, para que un crash a mitad deje un log coherente del estado.

---

## Fuera de alcance (v1)

- Deshacer automático de la migración desde la app (solo el log manual)
- Importar desde servicios en la nube (Google Photos, iCloud, Dropbox)
- Detección de fotos duplicadas entre el directorio fuente y el destino antes de mover
- Soporte para estructuras de Lightroom (catálogo .lrcat)
