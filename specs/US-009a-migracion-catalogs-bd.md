# Feature: Migración additive de BD — tabla `catalogs` y `catalog_id`

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** ninguna

---

## Historia de usuario

Como desarrollador que mantiene photoshelf,
quiero añadir la tabla `catalogs` y la columna `photos.catalog_id` de forma additive,
para que el sistema actual siga funcionando sin cambios mientras se prepara el terreno
para conectar múltiples catálogos.

---

## Descripción

Esta historia cubre únicamente el nivel de base de datos. No toca ningún endpoint ni componente de UI.
La estrategia es puramente additive:

1. Crear la tabla `catalogs` si no existe.
2. Añadir `photos.catalog_id` como columna **nullable con `DEFAULT 1`** para que todas las
   filas existentes hereden automáticamente el catálogo por defecto.
3. Insertar el catálogo por defecto (`id = 1`) usando `INSERT OR IGNORE` para que la migración
   sea idempotente (no falla si ya existe).
4. Crear los índices necesarios.

Todo lo anterior ocurre dentro de `initSchema` en `src/lib/db.ts`, que ya se ejecuta en cada
arranque de la aplicación. SQLite aplica los `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`
de forma segura en re-ejecuciones.

---

## Criterios de aceptación

### Base de datos

- [ ] Existe la tabla `catalogs` con columnas `id`, `name`, `root_path`, `scan_mode`, `color`, `created_at`
- [ ] `scan_mode` acepta solo los valores `'structured'` y `'flat'` (constraint `CHECK`)
- [ ] `root_path` tiene constraint `UNIQUE` (no se puede registrar el mismo directorio dos veces)
- [ ] La tabla `photos` tiene la columna `catalog_id INTEGER DEFAULT 1` con FK a `catalogs(id) ON DELETE CASCADE`
- [ ] Existe el índice `idx_photos_catalog` sobre `photos(catalog_id)`

### Catálogo por defecto

- [ ] Al arrancar la aplicación por primera vez (o tras la migración), existe una fila en `catalogs`
  con `id = 1`, `root_path = PHOTOS_PATH`, `scan_mode = 'structured'`
- [ ] El nombre por defecto del catálogo 1 es `'Biblioteca principal'`
- [ ] Todas las fotos existentes tienen `catalog_id = 1` (heredado del `DEFAULT`)

### Idempotencia y retrocompatibilidad

- [ ] `initSchema` puede ejecutarse N veces seguidas sin error ni duplicación de datos
- [ ] Toda la funcionalidad existente (escaneo, thumbnails, timeline, library) sigue operativa
  sin ningún otro cambio de código — ningún endpoint lee ni escribe `catalog_id` todavía
- [ ] Las queries existentes que hacen `SELECT … FROM photos` sin filtrar por `catalog_id` devuelven
  exactamente los mismos resultados que antes de la migración

---

## Cambios de código

### `src/lib/db.ts` — `initSchema`

```typescript
// Añadir antes de la tabla photos (o después, con IF NOT EXISTS):
db.exec(`
  CREATE TABLE IF NOT EXISTS catalogs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    root_path  TEXT NOT NULL UNIQUE,
    scan_mode  TEXT NOT NULL CHECK(scan_mode IN ('structured', 'flat')) DEFAULT 'structured',
    color      TEXT NOT NULL DEFAULT '#6b7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Catálogo por defecto — idempotente
const photosPath = process.env.PHOTOS_PATH ?? '/photos';
db.prepare(`
  INSERT OR IGNORE INTO catalogs (id, name, root_path, scan_mode, color)
  VALUES (1, 'Biblioteca principal', ?, 'structured', '#6b7280')
`).run(photosPath);

// Añadir columna catalog_id si no existe (SQLite no tiene ADD COLUMN IF NOT EXISTS)
const cols = db.prepare("PRAGMA table_info(photos)").all() as { name: string }[];
if (!cols.find(c => c.name === 'catalog_id')) {
  db.exec(`ALTER TABLE photos ADD COLUMN catalog_id INTEGER DEFAULT 1 REFERENCES catalogs(id) ON DELETE CASCADE`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_catalog ON photos(catalog_id)`);
}
```

> **Nota:** SQLite no soporta `ADD COLUMN … NOT NULL` sin DEFAULT, ni `ADD COLUMN IF NOT EXISTS`.
> El patrón `PRAGMA table_info` + comprobación manual es la forma idiomática para migraciones
> additive con `better-sqlite3`.

---

## Estrategia de coexistencia

Esta historia no introduce ningún cambio observable en la aplicación. El `catalog_id` queda
en la DB pero no es leído ni escrito por ningún código de producción hasta US-009b/c/d.
Se puede desplegar en producción con seguridad total antes de continuar con el resto de la épica.

**Rollback:** si fuera necesario revertir, basta con ejecutar:
```sql
DROP TABLE catalogs;           -- las FK de photos apuntan a ella
-- y opcionalmente: ALTER TABLE photos DROP COLUMN catalog_id  (no soportado en SQLite <3.35)
-- alternativa: recrear la tabla photos sin la columna
```
En la práctica el rollback es irrelevante porque la columna es invisible para el código actual.

---

## Fuera de alcance

- Añadir helpers de acceso (`getCatalogs`, `getCatalogById`) — eso va en US-009b
- Validar que `root_path` existe en disco — eso va en US-009b (al crear un catálogo desde la UI)
- Cambiar ningún endpoint ni componente de UI
