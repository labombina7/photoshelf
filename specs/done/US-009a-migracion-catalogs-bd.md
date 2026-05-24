# Feature: US-009a — Migración de BD: tabla `catalogs` y columna `catalog_id`

## Historia de usuario

Como desarrollador de photoshelf,
quiero que la base de datos tenga soporte para múltiples catálogos,
para que todas las historias de EPIC-001 puedan construirse sobre esta base sin romper los datos existentes.

---

## Descripción

Prerequisito de todo EPIC-001. Añade la tabla `catalogs` y la columna `catalog_id` en `photos`
con una migración segura que preserva todos los datos existentes asignándolos al catálogo
"Principal" con `id = 1`.

La migración usa el sistema de versioning ya existente en `src/lib/db.ts` (o lo introduce
si no existe).

---

## Criterios de aceptación

### Esquema
- [ ] Existe la tabla `catalogs` con columnas: `id`, `name`, `path`, `created_at`
- [ ] La tabla `photos` tiene la columna `catalog_id INTEGER REFERENCES catalogs(id) DEFAULT 1`
- [ ] La migración inserta el catálogo "Principal" con `id = 1` y el valor actual de `PHOTOS_PATH`
- [ ] Todas las fotos existentes tienen `catalog_id = 1` tras la migración

### Migración segura
- [ ] La migración usa `ALTER TABLE ... ADD COLUMN ... DEFAULT 1` (compatible con SQLite)
- [ ] Si la columna ya existe (migración repetida), no lanza error
- [ ] La migración corre automáticamente al arrancar la app (`src/lib/db.ts`)
- [ ] No hay pérdida de datos ni cambio de comportamiento en el catálogo existente

### Índice
- [ ] Existe un índice en `photos(catalog_id)` para filtrado eficiente

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/db.ts` | Añadir migración: CREATE TABLE catalogs, ALTER TABLE photos, INSERT catálogo default |

---

## Notas técnicas

- SQLite soporta `ALTER TABLE ADD COLUMN` pero NO `ALTER TABLE DROP COLUMN` en versiones antiguas.
  Usar `IF NOT EXISTS` o try/catch para idempotencia
- El valor de `PHOTOS_PATH` en el catálogo "Principal" se toma de `process.env.PHOTOS_PATH ?? '/photos'`
- No modificar ninguna query existente — eso es tarea de US-009c

---

## Fuera de alcance

- Interfaz de usuario para catálogos (US-009f, US-009g)
- Filtrado por `catalog_id` en queries (US-009c)
- Escaneo por catálogo (US-009d)
