# Feature: Resolución dinámica de `photosRoot` en thumbnails

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009a](US-009a-migracion-catalogs-bd.md)

---

## Historia de usuario

Como fotógrafo con catálogos en distintos directorios del NAS,
quiero que las miniaturas e imágenes originales de cada catálogo se sirvan correctamente
independientemente de dónde esté montada cada carpeta,
para poder ver todas las fotos sin que el servidor busque archivos en la ruta equivocada.

---

## Descripción

Actualmente los endpoints `/api/photos/[id]/thumbnail` y `/api/photos/[id]/original` tienen
`PHOTOS_PATH` hardcodeado como constante de módulo. Si una foto pertenece a un catálogo
cuya `root_path` es distinta (p. ej. `/nas/mobile` en lugar de `/photos`), el servidor
intentará leer el archivo desde la ruta incorrecta y fallará con un error 500.

Esta historia hace que ambos endpoints resuelvan `photosRoot` dinámicamente usando el
`root_path` del catálogo al que pertenece la foto, mediante un JOIN en la misma query
que ya se hace para obtener `photos.path`.

Adicionalmente, la clave de caché de thumbnails incorpora el `catalog_id` para evitar
colisiones entre catálogos con archivos de ruta relativa idéntica.

---

## Criterios de aceptación

### Endpoint `/api/photos/[id]/thumbnail`

- [ ] La query incluye un JOIN con `catalogs` para obtener `root_path` del catálogo de la foto
- [ ] `getThumbnail` recibe el `root_path` del catálogo en lugar del `PHOTOS_PATH` global
- [ ] Si el catálogo no existe (fila huérfana), el endpoint hace fallback a `PHOTOS_PATH` y
  loguea un warning — no devuelve 500
- [ ] La clave MD5 de caché usa el formato `${catalogId}:${relativePath}:${size}:${fit}`
- [ ] Las miniaturas ya cacheadas bajo la clave antigua (`${relativePath}:${size}:${fit}`)
  no se invalidan automáticamente — se regeneran la próxima vez que se soliciten

### Endpoint `/api/photos/[id]/original`

- [ ] Igual que thumbnail: `root_path` resuelto dinámicamente desde el catálogo de la foto
- [ ] Fallback a `PHOTOS_PATH` si el catálogo no existe

### Función `getThumbnail` en `src/lib/thumbnail.ts`

- [ ] Acepta un parámetro opcional `catalogId: number` para construir la clave de caché
- [ ] Si `catalogId` no se pasa (llamadas legacy), la clave de caché sigue siendo
  `${relativePath}:${size}:${fit}` para no invalidar la caché existente

---

## Cambios de código

### `src/app/api/photos/[id]/thumbnail/route.ts`

```typescript
const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // … auth …
  const { id } = await params;
  const db = getDb();

  // JOIN para obtener root_path del catálogo de la foto
  const photo = db.prepare(`
    SELECT p.path, p.catalog_id, COALESCE(c.root_path, ?) as root_path
    FROM photos p
    LEFT JOIN catalogs c ON c.id = p.catalog_id
    WHERE p.id = ?
  `).get(PHOTOS_PATH, parseInt(id, 10)) as
    { path: string; catalog_id: number; root_path: string } | undefined;

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const size = parseInt(req.nextUrl.searchParams.get('size') ?? '400', 10);
  const fit = req.nextUrl.searchParams.get('fit') === 'inside' ? 'inside' : 'cover';

  try {
    const { buffer, contentType } = await getThumbnail(
      photo.path,
      photo.root_path,   // ← dinámico
      size,
      fit,
      photo.catalog_id   // ← para la clave de caché
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Thumbnail error:', err);
    return NextResponse.json({ error: 'Failed to generate thumbnail' }, { status: 500 });
  }
}
```

### `src/lib/thumbnail.ts` — clave de caché con `catalogId`

```typescript
export async function getThumbnail(
  relativePath: string,
  photosRoot: string,
  size = DEFAULT_SIZE,
  fit: 'cover' | 'inside' = 'cover',
  catalogId?: number   // ← nuevo parámetro opcional
): Promise<{ buffer: Buffer; contentType: string }> {

  // Clave con catalogId si está disponible; compatible con caché antigua si no
  const cacheInput = catalogId !== undefined
    ? `${catalogId}:${relativePath}:${size}:${fit}`
    : `${relativePath}:${size}:${fit}`;

  const cacheKey = crypto.createHash('md5').update(cacheInput).digest('hex');
  // … resto igual …
}
```

---

## Notas técnicas

### Mitigación de colisiones de caché existente

Las fotos actuales (catálogo 1) tienen thumbnails cacheados con la clave antigua
`md5(path:size:fit)`. Tras este cambio, la clave nueva será `md5(1:path:size:fit)`.
La caché antigua queda huérfana pero no causa ningún error — simplemente ocupa espacio
en `data/.cache/` hasta que se limpie manualmente. No es necesario invalidarla.

Si se quisiera evitar la regeneración tras el despliegue, se puede hacer una migración
de nombres de archivo en caché (`rename md5(path) → md5(1:path)`), pero esto es opcional
y se considera fuera de alcance de esta historia.

### Fallback seguro con `COALESCE`

El `LEFT JOIN … COALESCE(c.root_path, ?)` garantiza que si por alguna razón la fila de
`catalogs` no existe (datos corruptos, FK sin índice), el endpoint sigue funcionando con
el `PHOTOS_PATH` de entorno en lugar de crashear.

---

## Estrategia de coexistencia

Con el catálogo por defecto (`id = 1`, `root_path = PHOTOS_PATH`), el resultado del JOIN
devuelve exactamente el mismo `root_path` que antes. El comportamiento observable es
idéntico al actual para todas las fotos existentes.

Solo cuando exista un catálogo secundario con `root_path` distinto el código toma un camino
diferente — y ese caso solo puede darse si se ha ejecutado US-009b (API de catálogos).

---

## Fuera de alcance

- Limpiar automáticamente los thumbnails huérfanos de la caché antigua
- Cambiar la URL pública de thumbnail para incluir el `catalogId` como parámetro
- Soporte de `srcset` / imágenes retina (cubierto en US-008)
