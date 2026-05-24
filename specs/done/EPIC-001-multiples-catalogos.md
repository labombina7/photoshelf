# EPIC-001: Múltiples catálogos de fotos

> Estado: ✅ Desplegada — PR #43 mergeado en main

## Resumen

Permitir al usuario gestionar múltiples bibliotecas de fotos independientes desde una única
instancia de photoshelf — por ejemplo, fotos personales, fotos de trabajo y fotos de un
proyecto específico, cada una en su directorio propio en el NAS.

---

## Motivación

Actualmente photoshelf gestiona una única carpeta de fotos configurada con `PHOTOS_PATH`.
Un fotógrafo que tiene varias carpetas organizadas por tipo de contenido (familia, clientes,
archivo) no puede gestionarlas desde una sola app — necesita instancias separadas.

Con múltiples catálogos, el usuario puede:
- Tener fotos de trabajo y personales separadas pero navegables desde la misma interfaz
- Asignar diferentes rutas del NAS a diferentes catálogos
- Cambiar de catálogo con un selector rápido sin recargar la app

---

## Historias hijas

| ID | Título | Esfuerzo | Prerequisitos |
|----|--------|---------|--------------|
| US-009a | Migración de BD — tabla `catalogs` + columna `catalog_id` | S | — |
| US-009b | Contexto de catálogo activo en el servidor | S | US-009a |
| US-009c | Filtrado de todas las queries por `catalog_id` | M | US-009a, US-016 |
| US-009d | Escaneo vinculado a catálogo específico | S | US-009a |
| US-009e | API REST de gestión de catálogos | S | US-009a |
| US-009f | UI — selector de catálogo en el sidebar | S | US-009b, US-009e |
| US-009g | UI — página de gestión de catálogos (CRUD) | M | US-009e |

---

## Modelo de datos

```sql
-- Nueva tabla
CREATE TABLE catalogs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  path    TEXT NOT NULL UNIQUE,  -- ruta absoluta en el NAS
  created_at INTEGER DEFAULT (unixepoch())
);

-- Modificación de la tabla photos
ALTER TABLE photos ADD COLUMN catalog_id INTEGER REFERENCES catalogs(id) DEFAULT 1;

-- Catálogo por defecto (migración de datos existentes)
INSERT INTO catalogs (id, name, path) VALUES (1, 'Principal', '/photos');
UPDATE photos SET catalog_id = 1 WHERE catalog_id IS NULL;
```

---

## Flujo de usuario

1. El usuario accede a Ajustes → Catálogos
2. Ve su catálogo actual ("Principal") y puede crear uno nuevo
3. Para crear: introduce nombre + ruta del NAS → la app valida que la ruta existe
4. Para cambiar de catálogo: usa el selector en el Sidebar (dropdown o pestañas)
5. Al cambiar de catálogo, todas las vistas (timeline, mapa, stats, library) se filtran por el nuevo catálogo
6. El catálogo activo se persiste en la sesión del usuario

---

## Compatibilidad con EPIC-002 (API iOS)

Todos los endpoints de EPIC-002 incluyen un parámetro opcional `catalogId` (default: 1)
diseñado desde el principio para soportar múltiples catálogos. Esto significa que cuando
EPIC-001 esté implementado, la app iOS soportará múltiples catálogos sin cambios de API.

---

## Criterios de éxito

- El usuario puede tener 2+ catálogos activos sin interferencia entre ellos
- Cambiar de catálogo tarda < 500ms (sólo cambia el filtro, no recarga la app)
- La migración de la BD es transparente — las fotos existentes se asignan al catálogo "Principal"
- Los endpoints de EPIC-002 funcionan correctamente con `catalogId` explícito

---

## Fuera de alcance (v1)

- Compartir fotos entre catálogos
- Catálogos con permisos diferenciados (multi-usuario)
- Catálogos en almacenamiento cloud (S3, Google Drive)
- Importar/exportar un catálogo
