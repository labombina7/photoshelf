# Feature: US-009c — Filtrado de todas las queries por `catalog_id`

## Historia de usuario

Como usuario de photoshelf con múltiples catálogos,
quiero que el timeline, la búsqueda, el mapa y las estadísticas sólo muestren las fotos del catálogo activo,
para que los catálogos estén completamente separados en la interfaz.

---

## Descripción

Aplica el filtro `catalog_id = ?` a todas las queries SQL que acceden a la tabla `photos`.
Usa `getActiveCatalogId()` de US-009b para obtener el catálogo activo en cada request.

Esta US es la de mayor superficie de cambio en EPIC-001, ya que toca todos los endpoints
que devuelven fotos. Prerequisito: US-009a (columna existe) y US-009b (helper de sesión).

---

## Criterios de aceptación

### Endpoints afectados
- [ ] `GET /api/photos` filtra por `catalog_id = ?`
- [ ] `GET /api/timeline` filtra por `catalog_id = ?`
- [ ] `GET /api/photos/groups` filtra por `catalog_id = ?`
- [ ] `GET /api/map` filtra por `catalog_id = ?`
- [ ] `GET /api/stats` filtra por `catalog_id = ?`
- [ ] `GET /api/tags` filtra por `catalog_id = ?`
- [ ] La búsqueda semántica (`/api/ai/search`) filtra candidatos por `catalog_id = ?`

### Comportamiento por defecto
- [ ] Con un único catálogo (`id = 1`), el comportamiento es idéntico al actual
- [ ] Los tests existentes siguen pasando (la DB de test inserta fotos en catalog_id = 1)

### Integridad
- [ ] No se pueden ver fotos de un catálogo al que el usuario no tiene acceso
- [ ] Las queries de tags, stats y agrupaciones son coherentes con el filtro de catálogo

---

## Componentes modificados

Todos los route handlers que hacen queries sobre `photos`. Ver EPIC-001 para la lista completa.

---

## Notas técnicas

- Si se usa `buildPhotoQuery` de US-016, añadir `catalogId` como parámetro — centraliza el cambio
- Si se usa la capa de repositorio de US-022, añadir `catalogId` al parámetro de cada función
- El `catalog_id` viene siempre de la sesión (no del cliente) para evitar manipulación

---

## Fuera de alcance

- Catálogos compartidos entre usuarios
- Migración de fotos entre catálogos
