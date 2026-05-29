# Feature: Exportar catálogo completo (anti lock-in)

## Historia de usuario

Como fotógrafo que valora el control total sobre sus datos,
quiero poder exportar todos mis metadatos, tags, favoritos y colecciones en un formato abierto y portable,
para nunca sentir que mis datos de organización están atrapados en photoshelf.

---

## Descripción

El vendor lock-in es uno de los mayores miedos de los fotógrafos que han sido "quemados" por Adobe o iCloud — perder años de trabajo de organización (ratings, tags, colecciones) cuando cambian de herramienta. photoshelf, al ser self-hosted y de código abierto, tiene la ventaja filosófica de estar en el lado correcto de este debate.

Esta US materializa esa ventaja con una feature concreta: un exportador completo que genera un paquete portable de todos los datos de organización en formatos estándar: JSON (para reimportar en cualquier herramienta que lo soporte), CSV (para procesar en Excel o scripts), y sidecars XMP por foto (estándar de la industria).

Lo que se exporta:
- Metadatos enriquecidos (tags, favoritos, rating si existe, temáticas asociadas)
- Estructura de colecciones/temáticas con sus fotos
- Historial de clasificaciones IA (qué modelo asignó qué tag)
- Álbumes inteligentes con sus reglas
- Todo en formato que permite re-importar en Lightroom, digiKam, o cualquier herramienta compatible con XMP

---

## Criterios de aceptación

### Configuración del export
- [ ] Página `/settings/export` con opciones de formato:
  - `JSON completo` — toda la DB relevante en un archivo estructurado
  - `CSV por tabla` — un archivo CSV por entidad (fotos, tags, temáticas, etc.)
  - `XMP sidecars` — un archivo `.xmp` por foto con sus metadatos en el directorio original
  - `Todo (ZIP)` — los tres formatos en un ZIP descargable
- [ ] Opción de incluir/excluir: tags IA, tags manuales, favoritos, temáticas, álbumes inteligentes
- [ ] Preview del tamaño estimado del export antes de generarlo

### Generación del export
- [ ] El export se genera en background con indicador de progreso
- [ ] El archivo resultante se descarga directamente desde el browser al completarse
- [ ] Para XMP sidecars, los archivos se escriben en el mismo directorio que la foto correspondiente (no se descargan — se escriben en disco)
- [ ] El JSON export incluye una versión de esquema para facilitar migraciones futuras: `{ "schema_version": 1, "exported_at": "...", "photos": [...] }`

### Formato JSON
- [ ] Cada foto en el JSON incluye: `filename`, `path`, `taken_at`, `camera`, `tags`, `favorite`, `themes`, `gps`
- [ ] Las temáticas y álbumes inteligentes se exportan con su estructura de reglas

### Formato XMP sidecars
- [ ] Un archivo `[nombre_foto].xmp` por foto con campos estándar: `dc:subject` (tags), `xmp:Rating` (favorito = 5 estrellas), `dc:description` (review IA si existe)
- [ ] Los XMP son compatibles con Lightroom Classic y digiKam
- [ ] Si ya existe un `.xmp` sidecar previo, se pregunta si sobreescribir o fusionar

### Historial y auditoría
- [ ] La página muestra el historial de exports anteriores: fecha, formato, tamaño, estado
- [ ] El export más reciente puede re-descargarse durante 24h sin regenerarlo

---

## API necesaria

### `POST /api/export/catalog`
Lanza la generación del export.

```json
{ "format": "json" | "csv" | "xmp" | "all", "include": { "ai_tags": true, "manual_tags": true, "favorites": true, "themes": true } }
```

### `GET /api/export/status`
`{ running, progress, total, format, download_url? }`

### `GET /api/export/download`
Descarga el archivo generado (ZIP o JSON según formato).

---

## Ruta y navegación

- Ruta: `/settings/export`
- Acceso: menú de ajustes → "Exportar datos"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/settings/export/page.tsx` | Página de configuración y export |
| `src/app/settings/export/ExportClient.tsx` | Client — formulario, progreso, historial |
| `src/app/api/export/catalog/route.ts` | Lanza generación |
| `src/app/api/export/status/route.ts` | Estado |
| `src/app/api/export/download/route.ts` | Descarga del archivo |
| `src/lib/catalogExporter.ts` | Lógica de export (JSON, CSV, XMP) |
| `src/lib/queries/export.ts` | Queries para reunir todos los datos en una sola pasada |

---

## Notas técnicas

- JSON export: queries a la DB con `better-sqlite3` síncrono, serializar con `JSON.stringify`. Para 100k fotos el JSON puede ser ~100MB — generar con un stream `fs.createWriteStream` en lugar de construir el objeto completo en memoria.
- XMP sidecars: generar con un template de string XML. Los campos XMP relevantes son `dc:subject` (array de tags), `xmp:Rating` (0-5), `exif:GPSLatitude/Longitude`. No requiere librería externa.
- CSV: usar `csv-stringify` (ya en el ecosistema Node, sin instalación adicional en muchos casos) o generarlo manualmente para evitar dependencias.
- Los XMP se escriben en disco en el servidor — no pasan por el navegador. El usuario debe tener acceso directo a los directorios de fotos para acceder a ellos.

---

## Fuera de alcance (v1)

- Importar un export JSON/XMP de otra herramienta (el proceso inverso)
- Export incrementales (solo cambios desde último export)
- Export de las imágenes originales (solo metadatos y organización)
- Sincronización automática con servicios externos (Nextcloud, NAS)
