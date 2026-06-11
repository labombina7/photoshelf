# Feature: Límite superior en /api/photos y slideshow optimizado

## Historia de usuario

Como operador de photoshelf,
quiero que el endpoint de listado de fotos tenga una cota máxima de resultados por petición,
para que ni clientes mal configurados ni el propio slideshow puedan forzar queries que agoten la memoria del servidor.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó que `GET /api/photos` acepta el parámetro `limit` sin ninguna restricción superior. El cliente interno (LibraryClient) ya envía `limit=5000` para el slideshow — una query que para cada foto carga también sus tags asociados mediante un segundo SELECT IN. En una biblioteca de 10.000 fotos con tags abundantes esto puede generar respuestas de varios megabytes y saturar SQLite.

**Solución en dos partes**:

1. **Cota máxima en el route handler**: aplicar `Math.min(limit, 1000)` antes de pasarlo a `listPhotos`. Cualquier valor por encima de 1000 se recorta silenciosamente.

2. **Slideshow optimizado**: la función `openSlideshow` en `LibraryClient.tsx` solicita `limit=5000` para obtener los IDs de las fotos, pero descarta todos los campos excepto `id`. Se debe añadir un endpoint ligero `GET /api/photos/ids` (o un parámetro `fields=id`) que devuelva solo los IDs sin cargar tags ni temas, permitiendo cualquier límite razonable para este caso de uso.

---

## Criterios de aceptación

### Cota máxima en /api/photos
- [ ] `GET /api/photos?limit=5000` devuelve como máximo 1000 fotos (recorte silencioso)
- [ ] `GET /api/photos?limit=200` sigue funcionando igual que antes
- [ ] El total (`total`) en la respuesta sigue siendo el total real, no el truncado
- [ ] El comportamiento de paginación no cambia para valores de limit dentro del rango

### Slideshow optimizado
- [ ] Existe un endpoint `GET /api/photos/ids` que acepta los mismos filtros que `/api/photos` pero devuelve solo `{ ids: number[], total: number }`
- [ ] El endpoint no tiene límite artificial (o tiene uno muy alto, ej. 50.000) porque solo devuelve enteros
- [ ] `LibraryClient.tsx` usa `/api/photos/ids` en `openSlideshow` en lugar de `/api/photos?limit=5000`
- [ ] El slideshow funciona correctamente con el nuevo endpoint (misma selección de fotos, mismo orden)

### Sin regresiones
- [ ] La barra de paginación en la biblioteca muestra el total correcto
- [ ] El slideshow abre correctamente con filtros activos (año, evento, favoritos, etc.)

---

## API necesaria

### `GET /api/photos/ids`
- **Auth**: sesión requerida (igual que `/api/photos`)
- **Query params**: mismos filtros que `/api/photos` (`year`, `event`, `theme`, `tag`, `favorite`, `untagged`, `q`, `camera`, filtros EXIF)
- **Response**: `{ ids: number[], total: number }`
- **Implementación**: query `SELECT p.id FROM photos p ... ORDER BY taken_at ASC, filename ASC` sin JOINs de tags

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/photos/route.ts` | Añadir `Math.min(limit, 1000)` |
| `src/app/api/photos/ids/route.ts` | Nuevo endpoint ligero que retorna solo IDs |
| `src/lib/queries/photos.ts` | Añadir función `listPhotoIds(filters)` |
| `src/app/library/LibraryClient.tsx` | Actualizar `openSlideshow` para usar `/api/photos/ids` |

---

## Notas técnicas

- La query de IDs no necesita JOIN con `photo_tags` ni `photo_themes` — es significativamente más rápida
- El orden debe ser idéntico al de `/api/photos` para que el slideshow mantenga coherencia con la vista de cuadrícula
- El límite de 1000 en `/api/photos` es orientativo; documentar la constante como `PHOTOS_MAX_LIMIT` en `config.ts`

---

## Fuera de alcance (v1)

- Paginación cursor-based en `/api/photos` (la API v1 ya la tiene; migrar la UI interna es otro refactor)
- Caché de resultados de fotos en Redis u otro almacén externo

> Estado: ✅ Desplegada
