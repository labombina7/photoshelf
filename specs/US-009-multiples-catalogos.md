# Feature: Múltiples catálogos de fotos

## Historia de usuario

Como fotógrafo con varias colecciones de imágenes en diferentes directorios
(biblioteca principal organizada por `año/evento` y biblioteca del móvil con estructura plana en el NAS),
quiero poder conectar múltiples catálogos en photoshelf y alternar o combinar su contenido desde la vista de timeline,
para tener una visión unificada de todas mis fotos sin tener que reorganizar mis carpetas existentes.

---

## Descripción

Actualmente photoshelf soporta una única fuente de fotos configurada mediante la variable de entorno
`PHOTOS_PATH` (por defecto `/photos`). El escáner (`src/lib/scanner.ts`) asume una estructura rígida de
`año/evento/fotos` — la función `walkPhotosPerYear` itera directorios numéricos como nombre de año, luego
los subdirectorios de evento, y extrae los campos `year` y `event` directamente de los nombres de carpeta.

Esta historia añade soporte para **múltiples catálogos** con las siguientes características:

- Cada catálogo tiene su propio directorio raíz, nombre, color identificativo y modo de escaneo
  (`structured` para la estructura `año/evento` ya existente, o `flat` para carpetas planas o con
  organización arbitraria).
- Los catálogos se gestionan desde la UI (añadir, renombrar, eliminar) sin tocar variables de entorno.
- El sidebar muestra cada catálogo como una sección colapsable con su árbol de navegación propio.
- La vista de timeline permite mostrar un catálogo individual o una vista combinada de todos.
- El catálogo configurado mediante `PHOTOS_PATH` se convierte automáticamente en el primer catálogo
  (`id = 1`) para mantener compatibilidad retroactiva total.

---

## Criterios de aceptación

### Gestión de catálogos

- [ ] Desde el sidebar, un botón "Añadir catálogo" abre un modal donde se introduce: nombre, ruta del
  directorio y modo de escaneo (`structured` / `flat`)
- [ ] El catálogo por defecto (antiguo `PHOTOS_PATH`) aparece automáticamente como primer catálogo; su
  nombre es editable pero su ruta no puede modificarse desde la UI para evitar inconsistencias con las
  rutas relativas ya almacenadas en `photos.path`
- [ ] Cada catálogo secundario puede renombrarse, cambiar de color y eliminarse
- [ ] Al eliminar un catálogo se eliminan en cascada sus registros de fotos en la DB (por
  `ON DELETE CASCADE`); los archivos físicos nunca se tocan
- [ ] Un catálogo con escaneo en curso muestra un spinner de progreso junto a su nombre en el sidebar

### Estructura del sidebar por catálogo

- [ ] Cada catálogo aparece como una sección colapsable en el sidebar encabezada por el nombre del
  catálogo con un punto de color identificativo
- [ ] Bajo el nombre del catálogo aparecen: "Todas las fotos (N)" y "Favoritos"
- [ ] En modo `structured`, la sección también despliega los años disponibles; al expandir un año se
  listan sus eventos como subitems (igual que la organización actual de carpetas)
- [ ] En modo `flat`, la sección muestra únicamente "Todas las fotos (N)" y "Favoritos" (sin árbol de
  año/evento, ya que la estructura no es predecible)
- [ ] El catálogo o subnodo activo queda resaltado con el estilo `active` del sidebar

### Vista de timeline con selector de catálogo

- [ ] La topbar de la vista de timeline incluye un selector (pills o dropdown) con las opciones: nombre
  de cada catálogo + "Todos los catálogos"
- [ ] Al seleccionar un catálogo, el timeline muestra únicamente las fotos de ese catálogo, reiniciando
  la paginación por cursor
- [ ] Al seleccionar "Todos los catálogos", el timeline combina fotos de todos los catálogos ordenadas
  por `taken_at DESC NULLS LAST, created_at DESC` (mismo criterio que el query actual)
- [ ] Las fotos en la vista combinada muestran un indicador visual pequeño del catálogo al que pertenecen
  (punto de color del catálogo, visible en hover)
- [ ] La selección del catálogo activo se persiste en `sessionStorage` bajo la clave
  `timeline_catalog` (coherente con `timeline_zoom_visual` y `photoshelf_timeline_level`)

### Escaneo multi-catálogo

- [ ] El botón "Reescanear biblioteca" del sidebar ejecuta el escaneo del catálogo activo; si la vista es
  "Todos los catálogos", escanea todos secuencialmente
- [ ] En modo `structured`, el escáner sigue la lógica actual de `walkPhotosPerYear` sin cambios
- [ ] En modo `flat`, el escáner recorre recursivamente todos los archivos con extensiones válidas
  (`PHOTO_EXTS`), sin asumir estructura de carpetas; `year` y `event` se derivan del EXIF (`taken_at`)
  cuando está disponible, o se almacenan como `year = 0, event = ''` si no hay metadatos de fecha
- [ ] El watcher automático (`folderWatcher.ts`) continúa observando únicamente el catálogo configurado
  como `PHOTOS_PATH`; los catálogos secundarios solo se escanean bajo demanda manual

### Thumbnails multi-catálogo

- [ ] El endpoint `/api/photos/[id]/thumbnail` resuelve la ruta absoluta del archivo usando el
  `root_path` del catálogo al que pertenece la foto, no el `PHOTOS_PATH` global
- [ ] La clave de caché MD5 en `data/.cache/` incluye el `catalog_id` para evitar colisiones entre
  catálogos que puedan tener rutas relativas idénticas:
  `md5(catalogId:relativePath:size:fit)`

---

## Modelo de datos

### Nueva tabla `catalogs`

```sql
CREATE TABLE IF NOT EXISTS catalogs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  root_path  TEXT NOT NULL UNIQUE,
  scan_mode  TEXT NOT NULL CHECK(scan_mode IN ('structured', 'flat')) DEFAULT 'structured',
  color      TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Modificación de `photos`

```sql
ALTER TABLE photos ADD COLUMN catalog_id INTEGER NOT NULL DEFAULT 1
  REFERENCES catalogs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_photos_catalog ON photos(catalog_id);
```

La migración en `initSchema` (dentro de `src/lib/db.ts`) inserta primero el catálogo por defecto
con `id = 1`, `root_path = PHOTOS_PATH`, `name = 'Biblioteca principal'`, `scan_mode = 'structured'`.
Las fotos existentes heredan `catalog_id = 1` gracias al `DEFAULT 1`.

---

## API necesaria

### `GET /api/catalogs`

Devuelve todos los catálogos con conteo de fotos.

**Respuesta:**
```json
{
  "catalogs": [
    {
      "id": 1,
      "name": "Biblioteca principal",
      "root_path": "/photos",
      "scan_mode": "structured",
      "color": "#6b7280",
      "photo_count": 5240
    },
    {
      "id": 2,
      "name": "Móvil (NAS)",
      "root_path": "/nas/mobile",
      "scan_mode": "flat",
      "color": "#3b82f6",
      "photo_count": 1830
    }
  ]
}
```

### `POST /api/catalogs`

Crea un nuevo catálogo.

**Body:** `{ name, root_path, scan_mode, color }`

Valida que `root_path` exista y sea accesible por el servidor antes de crear el registro.

### `PATCH /api/catalogs/[id]`

Actualiza `name` o `color`. La `root_path` y `scan_mode` no son modificables después de la creación
para preservar la integridad de las rutas relativas almacenadas.

### `DELETE /api/catalogs/[id]`

Elimina el catálogo y sus fotos por cascada. Devuelve `409` si se intenta eliminar `id = 1`
(catálogo por defecto protegido).

### `POST /api/scan` (modificado)

Acepta un campo opcional `catalogId` en el body JSON. Sin él, escanea el catálogo `id = 1`
para mantener retrocompatibilidad con el botón actual.

### `GET /api/timeline` (modificado)

Acepta el parámetro opcional `catalogId`. Si se omite o vale `all`, devuelve fotos de todos
los catálogos con el mismo cursor y ordenación actual.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/db.ts` | Añadir tabla `catalogs`, migración de `photos.catalog_id`, helpers `getCatalogs()` y `getCatalogById()` |
| `src/lib/scanner.ts` | Recibir `catalogId` y `scanMode`; añadir `walkPhotosFlat()` para modo plano |
| `src/lib/thumbnail.ts` | Recibir `photosRoot` dinámico desde el catálogo de la foto; actualizar clave de caché con `catalogId` |
| `src/components/Sidebar.tsx` | Secciones colapsables por catálogo con árbol `año → evento`; botón "Añadir catálogo" |
| `src/app/timeline/TimelineClient.tsx` | Selector de catálogo en topbar; persistencia en `sessionStorage`; filtro en `fetchMore` |
| `src/app/api/catalogs/route.ts` | GET y POST de catálogos |
| `src/app/api/catalogs/[id]/route.ts` | PATCH y DELETE por catálogo |
| `src/app/api/scan/route.ts` | Aceptar `catalogId` en el body POST |
| `src/app/api/timeline/route.ts` | Filtrar por `catalog_id` cuando se especifica |
| `src/app/api/photos/[id]/thumbnail/route.ts` | Resolver `photosRoot` desde `catalog_root` del catálogo de la foto |

---

## Notas técnicas

### Compatibilidad retroactiva

El catálogo por defecto recibe `id = 1` en la migración. Todas las fotos existentes tienen sus rutas
relativas almacenadas bajo la estructura `año/evento/archivo` referenciada respecto a `PHOTOS_PATH`,
que ahora será el `root_path` del catálogo `id = 1`. No es necesario reformatear ningún dato.

### Escáner en modo flat

```typescript
// Nuevo modo en src/lib/scanner.ts
async function walkPhotosFlat(
  root: string,
  catalogId: number,
  commit: (items: ScannedPhoto[]) => void,
  onProgress?: ProgressCallback
): Promise<void> {
  // Recorre recursivamente sin asumir estructura de año/evento.
  // year y event se derivan del EXIF (taken_at) si está disponible;
  // en caso contrario: year = 0, event = ''.
  const allFiles = await collectFilesRecursive(root);
  const batches = chunk(allFiles, 50);
  for (const batch of batches) {
    const photos: ScannedPhoto[] = [];
    for (const absPath of batch) {
      const rel = path.relative(root, absPath);
      const exifData = await extractExif(absPath);
      const year = exifData.taken_at ? new Date(exifData.taken_at).getUTCFullYear() : 0;
      const stat = await fs.stat(absPath);
      photos.push({ path: rel, filename: path.basename(absPath), year, event: '', size_bytes: stat.size, catalogId, ...exifData });
    }
    commit(photos);
    onProgress?.('', batches.indexOf(batch), batches.length);
  }
}
```

### Selector de catálogo en el timeline

```tsx
// En TimelineClient.tsx, nuevo estado:
const [activeCatalog, setActiveCatalog] = useState<number | 'all'>(() => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('timeline_catalog');
    if (stored === 'all') return 'all';
    const n = parseInt(stored ?? '');
    if (!isNaN(n)) return n;
  }
  return 'all';
});

// Al construir la URL de fetchMore:
if (activeCatalog !== 'all') params.set('catalogId', String(activeCatalog));
```

### Clave de caché de thumbnails actualizada

```typescript
// src/lib/thumbnail.ts
const cacheKey = crypto
  .createHash('md5')
  .update(`${catalogId}:${relativePath}:${size}:${fit}`)
  .digest('hex');
```

### Resolución dinámica de photosRoot en el endpoint de thumbnail

```typescript
// src/app/api/photos/[id]/thumbnail/route.ts
const photo = db.prepare(`
  SELECT p.path, c.root_path
  FROM photos p JOIN catalogs c ON c.id = p.catalog_id
  WHERE p.id = ?
`).get(id) as { path: string; root_path: string } | undefined;

if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

const { buffer, contentType } = await getThumbnail(
  photo.path,
  photo.root_path,  // ← dinámico, no PHOTOS_PATH global
  size,
  fit,
  catalogId         // ← para la clave de caché
);
```

---

## Fuera de alcance (v1)

- Sincronización automática de catálogos remotos (SMB, SFTP, cloud)
- Watcher automático para catálogos secundarios (solo el catálogo `id = 1` tiene watcher)
- Importar o copiar fotos físicamente de un catálogo a otro
- Configurar catálogos desde un archivo externo (`catalogs.json`) en lugar de la DB
- Fusión o deduplicación de fotos entre catálogos
- Permisos por catálogo (todos los catálogos son accesibles para el usuario autenticado)
