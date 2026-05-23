# Feature: API REST CRUD de catálogos

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009a](US-009a-migracion-catalogs-bd.md)

---

## Historia de usuario

Como desarrollador que integra múltiples catálogos en photoshelf,
quiero una API REST para listar, crear, actualizar y eliminar catálogos,
para que la UI y el escáner puedan operar sobre catálogos sin acceder directamente a la BD.

---

## Descripción

Esta historia añade los endpoints de gestión de catálogos y los helpers de acceso a la DB.
No toca ningún componente de UI. Toda la lógica es backend puro, análoga a como ya existen
`/api/themes` y `/api/projects`.

El catálogo `id = 1` (el catálogo por defecto creado en US-009a) tiene protecciones especiales:
no puede eliminarse y su `root_path` no puede modificarse, para preservar la integridad de las
rutas relativas ya almacenadas en `photos.path`.

---

## Criterios de aceptación

### `GET /api/catalogs`

- [ ] Devuelve todos los catálogos con su conteo de fotos (`photo_count`)
- [ ] El conteo se calcula con `COUNT(photos.id)` agrupado por `catalog_id`
- [ ] Responde `200` con el array aunque no haya catálogos secundarios
- [ ] El catálogo por defecto (`id = 1`) aparece siempre primero en la lista

### `POST /api/catalogs`

- [ ] Crea un nuevo catálogo con `name`, `root_path`, `scan_mode` y `color` (opcional)
- [ ] Valida que `root_path` es una ruta accesible por el servidor (usa `fs.access`) antes de crear el registro;
  devuelve `400` con mensaje claro si no existe o no es un directorio
- [ ] Devuelve `409` si ya existe un catálogo con ese `root_path`
- [ ] Devuelve `201` con el nuevo catálogo creado

### `PATCH /api/catalogs/[id]`

- [ ] Permite actualizar `name` y `color`
- [ ] **No permite** actualizar `root_path` ni `scan_mode` (devuelve `400` si se incluyen en el body)
- [ ] Devuelve `404` si el catálogo no existe
- [ ] Devuelve `200` con el catálogo actualizado

### `DELETE /api/catalogs/[id]`

- [ ] Elimina el catálogo y sus fotos en cascada (por `ON DELETE CASCADE` en la FK)
- [ ] Devuelve `403` si se intenta eliminar `id = 1` (catálogo por defecto protegido)
- [ ] Devuelve `404` si el catálogo no existe
- [ ] No elimina ningún archivo físico del disco

### Helpers en `src/lib/db.ts`

- [ ] `getCatalogs(db)` devuelve todos los catálogos con `photo_count`
- [ ] `getCatalogById(db, id)` devuelve un catálogo por id o `undefined` si no existe

---

## API — contratos detallados

### `GET /api/catalogs` — respuesta

```json
{
  "catalogs": [
    {
      "id": 1,
      "name": "Biblioteca principal",
      "root_path": "/photos",
      "scan_mode": "structured",
      "color": "#6b7280",
      "photo_count": 5240,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Móvil (NAS)",
      "root_path": "/nas/mobile",
      "scan_mode": "flat",
      "color": "#3b82f6",
      "photo_count": 1830,
      "created_at": "2026-05-20T10:00:00.000Z"
    }
  ]
}
```

### `POST /api/catalogs` — body

```json
{
  "name": "Móvil (NAS)",
  "root_path": "/nas/mobile",
  "scan_mode": "flat",
  "color": "#3b82f6"
}
```

### `PATCH /api/catalogs/[id]` — body

```json
{ "name": "Archivos del NAS", "color": "#10b981" }
```

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/catalogs/route.ts` | `GET` y `POST` de catálogos |
| `src/app/api/catalogs/[id]/route.ts` | `PATCH` y `DELETE` por id |
| `src/lib/db.ts` | Añadir `getCatalogs()` y `getCatalogById()` |

---

## Notas técnicas

### Query de conteo de fotos por catálogo

```typescript
// src/lib/db.ts
export function getCatalogs(db: Database.Database) {
  return db.prepare(`
    SELECT c.*, COUNT(p.id) as photo_count
    FROM catalogs c
    LEFT JOIN photos p ON p.catalog_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC
  `).all();
}
```

### Validación de `root_path` en POST

```typescript
// src/app/api/catalogs/route.ts — POST handler
import fs from 'fs/promises';

const { name, root_path, scan_mode = 'structured', color = '#6b7280' } = await req.json();
try {
  const stat = await fs.stat(root_path);
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: 'root_path no es un directorio' }, { status: 400 });
  }
} catch {
  return NextResponse.json({ error: 'root_path no existe o no es accesible' }, { status: 400 });
}
```

---

## Estrategia de coexistencia

Estos endpoints son additive: no modifican rutas existentes. El código de producción actual
(`/api/scan`, thumbnails, timeline) no llama a `/api/catalogs` y sigue funcionando exactamente igual.

Los endpoints pueden desplegarse y probarse en cualquier entorno con un único catálogo —
`GET /api/catalogs` simplemente devolverá el array con el catálogo por defecto.

---

## Fuera de alcance

- UI para añadir/eliminar catálogos desde la app (va en US-009g)
- Disparar un escaneo al crear un catálogo nuevo (el usuario lo hace manualmente)
- Validar que `root_path` no es un subdirectorio de otro catálogo ya registrado
