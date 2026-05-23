# Feature: US-009g — UI: página de gestión de catálogos (CRUD)

## Historia de usuario

Como usuario de photoshelf,
quiero una página de configuración donde pueda crear, renombrar y eliminar catálogos,
para gestionar mis bibliotecas de fotos de forma visual sin tocar la configuración del servidor.

---

## Descripción

Página de gestión completa en `/settings/catalogs` que permite al usuario ver todos sus
catálogos, crear nuevos, renombrarlos y eliminarlos. Usa los endpoints de US-009e.

---

## Criterios de aceptación

### Lista de catálogos
- [ ] La página `/settings/catalogs` muestra una tabla/lista con todos los catálogos:
  nombre, ruta, número de fotos, fecha de creación
- [ ] El catálogo activo tiene un badge "Activo"
- [ ] El catálogo "Principal" (id=1) tiene un badge "Principal" y no tiene botón de eliminar

### Crear catálogo
- [ ] Hay un botón "Nuevo catálogo" que abre un formulario inline o modal
- [ ] El formulario pide: nombre (texto) y ruta en el NAS (texto)
- [ ] Al enviar, llama a `POST /api/catalogs` y muestra el nuevo catálogo en la lista
- [ ] Si la ruta no existe, muestra un mensaje de error inline

### Renombrar catálogo
- [ ] Cada catálogo tiene un botón de edición (icono lápiz) que convierte el nombre en un input inline
- [ ] Al confirmar (Enter o botón Guardar), llama a `PATCH /api/catalogs/[id]`
- [ ] Al cancelar (Escape o botón Cancelar), restaura el nombre original

### Eliminar catálogo
- [ ] Cada catálogo (excepto "Principal") tiene un botón de eliminar (icono basura)
- [ ] Al pulsar, aparece una confirmación: "¿Eliminar «nombre»? Se perderán los N registros de la BD (las fotos en disco no se borran)"
- [ ] Al confirmar, llama a `DELETE /api/catalogs/[id]` y elimina el catálogo de la lista

### Feedback y errores
- [ ] Las operaciones muestran un spinner mientras están en curso
- [ ] Los errores se muestran como toast o mensaje inline (no alert() nativo)

---

## Ruta y navegación

- Nueva página: `/settings/catalogs` (`src/app/settings/catalogs/page.tsx`)
- Enlace en la navegación del Sidebar (bajo "Ajustes" si existe) o accesible desde el CatalogSwitcher

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/settings/catalogs/page.tsx` | Nuevo — página de gestión de catálogos |
| `src/components/CatalogList.tsx` | Nuevo — lista de catálogos con acciones |
| `src/components/CatalogForm.tsx` | Nuevo — formulario de creación/edición |
| `src/components/Sidebar.tsx` | Añadir enlace a `/settings/catalogs` |

---

## Notas técnicas

- La página puede ser un Client Component que carga los catálogos con `fetch('/api/catalogs')`
- Las acciones de edición/eliminación se confirman con el patrón optimistic update + rollback en error
- El número de fotos por catálogo se obtiene de `GET /api/catalogs` (incluye `photoCount`)

---

## Fuera de alcance

- Importar/exportar la configuración de catálogos
- Reordenar catálogos
- Fusionar dos catálogos
