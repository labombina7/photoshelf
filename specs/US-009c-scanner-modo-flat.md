# Feature: Escáner con detección automática de estructura

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009a](US-009a-migracion-catalogs-bd.md)

---

## Historia de usuario

Como fotógrafo que conecta una biblioteca del móvil sin estructura de carpetas por año/evento,
quiero que photoshelf detecte automáticamente si un catálogo está organizado por año/evento o no,
para no tener que saber ni decidir cómo están organizadas mis fotos — el sistema se adapta solo.

---

## Descripción

El escáner actual asume invariablemente la estructura `año/evento/archivo`: `walkPhotosPerYear`
itera solo directorios cuyo nombre sea un entero de 4 dígitos (año) y luego sus subdirectorios
como eventos. Una biblioteca plana — JPGs directamente en el root, o en carpetas sin nombres
numéricos — no produce ningún resultado con el escáner actual.

Esta historia añade dos cosas:

1. **Detección automática de estructura** (`detectScanMode`): en el primer escaneo de un catálogo,
   el sistema inspecciona los subdirectorios de primer nivel del directorio raíz. Si el 70 % o
   más tienen un nombre numérico de 4 dígitos (patrón de año, rango 1900–2099), el catálogo se
   clasifica como `structured`; en cualquier otro caso, como `flat`. El modo detectado se persiste
   en `catalogs.scan_mode` y se reutiliza en todos los escaneos posteriores.

2. **Modo `flat`** (`walkPhotosFlat`): nuevo camino de escaneo que recorre recursivamente todos los
   archivos de imagen sin asumir estructura, derivando `year` y `event` del EXIF cuando está
   disponible.

El usuario nunca elige ni ve el modo de escaneo. Es un detalle de implementación interno.

### Ajuste necesario en US-009a

La tabla `catalogs` creada en US-009a define `scan_mode TEXT NOT NULL DEFAULT 'structured'`.
Para soportar la detección automática, la columna debe ser **nullable** (sin `NOT NULL`) y la
inserción del catálogo por defecto (`id = 1`) sigue usando `'structured'` explícitamente porque
su estructura es conocida. Los catálogos secundarios se insertan con `scan_mode = NULL` para
indicar "pendiente de detección".

```sql
-- Cambio en initSchema respecto a US-009a:
scan_mode TEXT CHECK(scan_mode IN ('structured', 'flat'))
-- sin NOT NULL ni DEFAULT — NULL significa "detectar en el primer escaneo"
```

El catálogo 1 siempre se crea con `'structured'` explícito, por lo que no pasa por detección.

---

## Criterios de aceptación

### Detección automática (`detectScanMode`)

- [ ] La función `detectScanMode(root: string): Promise<'structured' | 'flat'>` lee solo los
  directorios de **primer nivel** de `root` (no recursivo) con `fs.readdir`
- [ ] Un directorio "candidato a año" es aquel cuyo nombre cumple: es numérico, tiene exactamente
  4 dígitos y su valor está en el rango `[1900, 2099]`
- [ ] Si el número de candidatos a año es ≥ 70 % del total de subdirectorios de primer nivel,
  devuelve `'structured'`; en cualquier otro caso devuelve `'flat'`
- [ ] Si no hay ningún subdirectorio de primer nivel (directorio vacío o con solo archivos),
  devuelve `'flat'`
- [ ] La detección se hace sobre directorios únicamente; los archivos sueltos en el root no cuentan
  para el ratio

### Persistencia del modo detectado

- [ ] Al iniciar el escaneo de un catálogo con `scan_mode = NULL`, se ejecuta `detectScanMode`
  antes de comenzar a indexar fotos
- [ ] El modo detectado se escribe en `catalogs.scan_mode` antes de iniciar el walk, de forma que
  si el proceso se interrumpe, el modo queda guardado para el siguiente intento
- [ ] En escaneos posteriores del mismo catálogo (`scan_mode` ya no es `NULL`), no se ejecuta
  la detección — se usa el valor almacenado directamente
- [ ] Para el catálogo principal (`id = 1`, `scan_mode = 'structured'` desde la migración), la
  detección nunca se ejecuta

### Modo flat (`walkPhotosFlat`)

- [ ] Recorre recursivamente todos los archivos con extensiones válidas (`PHOTO_EXTS`) desde
  `photosRoot`, sin importar profundidad ni nombre de carpetas
- [ ] `year` se deriva de `taken_at` del EXIF si está disponible; si no hay fecha EXIF, `year = 0`
- [ ] `event` se toma del nombre del directorio inmediatamente padre del archivo
  (p. ej. `/nas/mobile/vacaciones/IMG_001.jpg` → `event = 'vacaciones'`);
  si el archivo está en el root directo, `event = ''`
- [ ] Las rutas relativas en `photos.path` son relativas a `photosRoot` del catálogo
  (igual que en modo structured)
- [ ] El escáner procesa los archivos en lotes de 50 para acotar picos de memoria

### Parámetro `catalogId` en `scanLibrary`

- [ ] `scanLibrary` acepta `options: { catalogId?: number }` (ya no recibe `scanMode` — lo
  resuelve internamente)
- [ ] Escribe el `catalogId` recibido en cada fila insertada/actualizada en `photos`
- [ ] El upsert (`ON CONFLICT(path) DO UPDATE`) actualiza `catalog_id` solo si la fila
  existente tiene `catalog_id IS NULL`

### Endpoint `/api/scan`

- [ ] Acepta un campo opcional `catalogId` en el body JSON del POST
- [ ] Si `catalogId` está presente, carga el catálogo con `getCatalogById`, usa su `root_path`
  como `photosRoot`; el `scan_mode` lo resuelve internamente `scanLibrary`
- [ ] Si `catalogId` está ausente, usa `PHOTOS_PATH` y `catalogId = 1`
  (retrocompatibilidad total con el botón actual del sidebar)
- [ ] Devuelve `404` si se especifica un `catalogId` que no existe
- [ ] No se pueden lanzar dos escaneos simultáneos (estado global en `scanState.ts`)

### Tests

- [ ] Test unitario de `detectScanMode`: directorios `['2020', '2021', '2022', 'misc']` → `'structured'`
  (3/4 = 75 % ≥ 70 %)
- [ ] Test unitario de `detectScanMode`: directorios `['vacaciones', 'trabajo', 'familia']` → `'flat'`
- [ ] Test unitario de `detectScanMode`: directorio vacío → `'flat'`
- [ ] Test unitario de `detectScanMode`: `['2020', '2021', 'eventos', 'misc', 'otros']` → `'flat'`
  (2/5 = 40 % < 70 %)
- [ ] Test de `walkPhotosFlat`: árbol simulado con fs virtual verifica que se indexan archivos en
  subdirectorios arbitrarios y que `year`/`event` se derivan correctamente del EXIF

---

## Cambios de código

### `src/lib/scanner.ts` — detección y modo flat

```typescript
const YEAR_RE = /^\d{4}$/;

/**
 * Inspecciona los subdirectorios de primer nivel de `root` y decide el modo de escaneo.
 * Threshold: ≥70% de subdirectorios con nombre numérico de 4 dígitos en rango [1900, 2099].
 */
export async function detectScanMode(root: string): Promise<'structured' | 'flat'> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter(e => e.isDirectory());
  if (dirs.length === 0) return 'flat';

  const yearDirs = dirs.filter(e => {
    if (!YEAR_RE.test(e.name)) return false;
    const n = parseInt(e.name, 10);
    return n >= 1900 && n <= 2099;
  });

  return yearDirs.length / dirs.length >= 0.7 ? 'structured' : 'flat';
}

/**
 * Firma actualizada: ya no recibe scanMode — lo resuelve internamente.
 */
export async function scanLibrary(
  photosRoot: string,
  onProgress?: ProgressCallback,
  options: { catalogId?: number } = {}
): Promise<{ added: number; total: number }> {
  const db = getDb();
  const catalogId = options.catalogId ?? 1;

  // Determinar o recuperar el modo de escaneo
  let scanMode: 'structured' | 'flat' = 'structured';
  if (catalogId !== 1) {
    const catalog = db.prepare('SELECT scan_mode FROM catalogs WHERE id = ?').get(catalogId) as
      { scan_mode: string | null } | undefined;

    if (catalog?.scan_mode) {
      scanMode = catalog.scan_mode as 'structured' | 'flat';
    } else {
      // Primer escaneo: detectar y persistir
      scanMode = await detectScanMode(photosRoot);
      db.prepare('UPDATE catalogs SET scan_mode = ? WHERE id = ?').run(scanMode, catalogId);
      console.log(`[scan] Modo detectado para catálogo ${catalogId}: ${scanMode}`);
    }
  }

  // Despachar al walker correspondiente
  if (scanMode === 'flat') {
    await walkPhotosFlat(photosRoot, catalogId, insertBatch, onProgress);
  } else {
    await walkPhotosPerYear(photosRoot, insertBatch, totalEvents, onProgress);
  }

  // … conteo y return …
}
```

### `walkPhotosFlat` — nuevo

```typescript
async function walkPhotosFlat(
  root: string,
  catalogId: number,
  commit: (items: ScannedPhoto[]) => void,
  onProgress?: ProgressCallback
): Promise<void> {
  const allFiles = await collectFilesRecursive(root);
  const batches = chunk(allFiles, 50);
  let done = 0;

  for (const batch of batches) {
    const photos: ScannedPhoto[] = [];
    for (const absPath of batch) {
      const rel = path.relative(root, absPath);
      const stat = await fs.stat(absPath).catch(() => null);
      if (!stat?.isFile()) continue;
      const exifData = await extractExif(absPath);
      const year = exifData.taken_at
        ? new Date(exifData.taken_at).getUTCFullYear()
        : 0;
      const parentDir = path.basename(path.dirname(absPath));
      const event = path.dirname(rel) !== '.' ? parentDir : '';
      photos.push({
        path: rel,
        filename: path.basename(absPath),
        year,
        event,
        size_bytes: stat.size,
        catalogId,
        ...exifData,
      });
    }
    if (photos.length > 0) commit(photos);
    done += batch.length;
    onProgress?.(`flat: ${done}/${allFiles.length}`, done, allFiles.length);
  }
}

async function collectFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFilesRecursive(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (PHOTO_EXTS.has(ext)) results.push(full);
    }
  }
  return results;
}
```

### `src/app/api/scan/route.ts` — sin referencia a `scan_mode` manual

```typescript
export async function POST(req: NextRequest) {
  // … auth check …
  const body = await req.json().catch(() => ({}));
  const catalogId: number | undefined = body.catalogId;

  let photosRoot = PHOTOS_PATH;

  if (catalogId !== undefined) {
    const db = getDb();
    const catalog = getCatalogById(db, catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
    photosRoot = catalog.root_path;
    // scan_mode lo resuelve internamente scanLibrary — no se lee aquí
  }

  // … arranque del escaneo en background …
  scanLibrary(photosRoot, onProgress, { catalogId: catalogId ?? 1 })
  // …
}
```

---

## Notas técnicas

### Umbral del 70 %

El umbral del 70 % cubre el caso más habitual de contaminación: una biblioteca estructurada
que tiene una carpeta extra en el root (p. ej. `Recibidas/` o `Procesadas/`) junto a los
directorios de año. Con ese threshold, hasta 3 carpetas no-año en una biblioteca con 10 años
se clasifican correctamente como `structured`.

Si en el futuro un catálogo clasificado incorrectamente necesita corregirse, bastará con
actualizar `scan_mode` directamente en la DB (o exponer un override en la UI de gestión de
catálogos, lo cual queda fuera de alcance de esta historia).

### Persistencia antes del walk

El modo detectado se escribe en la DB **antes** de iniciar el recorrido de archivos.
Si el proceso se interrumpe a mitad del escaneo, el siguiente intento no vuelve a ejecutar
la detección — usa el modo ya almacenado. Esto evita que una segunda detección sobre un
directorio parcialmente escaneado (ahora con más o menos entradas) produzca un resultado
diferente al original.

### El catálogo 1 nunca detecta

El catálogo principal (`id = 1`) tiene `scan_mode = 'structured'` fijo desde la migración de
US-009a. `scanLibrary` tiene una rama explícita `if (catalogId !== 1)` para saltarse la
detección, preservando el comportamiento actual sin ninguna inspección de disco adicional.

---

## Estrategia de coexistencia

- El camino de retrocompatibilidad (sin `catalogId` en el body de `/api/scan`) salta
  directamente a `walkPhotosPerYear` con `catalogId = 1`, exactamente igual que hoy.
- `detectScanMode` solo se invoca para catálogos secundarios con `scan_mode = NULL` —
  una situación que no puede ocurrir hasta que se cree un catálogo adicional (US-009g).
- Esta historia puede desplegarse y los tests pueden ejecutarse de forma totalmente aislada
  del resto de la épica.

---

## Fuera de alcance

- Override manual del modo de escaneo desde la UI (el usuario no ve ni toca `scan_mode`)
- Re-detección automática si la estructura de un catálogo cambia con el tiempo
- Watcher automático para catálogos secundarios
- Deduplicación de archivos entre catálogos durante el escaneo
- Progreso de escaneo independiente por catálogo (el estado sigue siendo global)
