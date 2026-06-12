# Feature: Paginación real de fotos por evento (fin del truncado silencioso)

> Estado: ✅ Desplegada

## Historia de usuario

Como fotógrafo con eventos grandes (bodas, viajes largos),
quiero ver todas las fotos de un evento aunque supere las 1000,
para no perder fotos sin ningún aviso de que faltan.

---

## Descripción

El tech debt audit del 2026-06-12 detectó un desacuerdo silencioso entre cliente y servidor: `PhotoGrid` pide hasta `limit=2000` fotos por evento en una sola petición (`PhotoGrid.tsx:151`), pero `/api/photos` capa el límite a `PHOTOS_MAX_LIMIT = 1000` (`route.ts:22`, introducido por US-086 para proteger la memoria del servidor — correcto). Resultado: un evento con 1400 fotos muestra 1000 y ni el usuario ni la UI saben que faltan 400.

Además, pedir ~1000 fotos con sus tags de golpe es un payload JSON pesado, especialmente en móvil. El render ya es incremental (estado `visible` + IntersectionObserver) — lo que falta es que el **fetch** también lo sea.

---

## Criterios de aceptación

### Paginación encadenada
- [ ] PhotoGrid carga las fotos de un evento por páginas (p. ej. 200) usando `page`/`offset` contra `/api/photos`
- [ ] El sentinel de scroll infinito dispara el fetch de la siguiente página cuando el usuario se acerca al final de lo descargado
- [ ] Un evento de >1000 fotos muestra todas sus fotos al hacer scroll completo

### Transparencia
- [ ] Mientras quedan páginas por cargar, el contador del grupo muestra el total real (`group.count`) — ya disponible — y el estado de carga
- [ ] Si una página falla, se muestra un mensaje con opción de reintentar (no truncado silencioso)

### Rendimiento
- [ ] La primera página renderiza igual de rápido o más que hoy (payload menor)
- [ ] El slideshow y la selección siguen funcionando sobre el conjunto cargado

### Tests
- [ ] Test del encadenado de páginas (mock de fetch con 3 páginas)

---

## API necesaria

- `GET /api/photos` — sin cambios de contrato; ya soporta `page` y devuelve `total`. Verificar que devuelve `hasMore` o que el cliente lo derive de `total`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/PhotoGrid.tsx` | Fetch paginado encadenado al scroll |
| `src/app/api/photos/route.ts` | (Solo si falta) exponer `hasMore` |

---

## Notas técnicas

- Mantener `PHOTOS_MAX_LIMIT = 1000` en el servidor — la protección de US-086 es correcta; el bug es del cliente.
- El compartir-evento (`ShareEventItem`) usa `/api/photos/ids` con `limit=300` (cap de SHARE_MAX_PHOTOS) — no afectado.
- Cuidado con `toggleFavorite`: opera por índice sobre el array completo; con paginación el array crece — la búsqueda por `id` ya implementada lo hace seguro.

---

## Fuera de alcance (v1)

- Virtualización del DOM (react-window) — el render incremental actual es suficiente
- Cambiar la API a cursor (la v1 ya lo hace; ver US-107)
