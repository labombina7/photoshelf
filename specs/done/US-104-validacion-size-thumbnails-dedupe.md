# Feature: Validación del parámetro size en thumbnails y deduplicación de generación

## Historia de usuario

Como operador de photoshelf,
quiero que el endpoint de miniaturas solo acepte tamaños conocidos y no genere el mismo thumbnail varias veces en paralelo,
para proteger la CPU y el disco del servidor frente a peticiones malformadas o ráfagas de carga.

---

## Descripción

Dos hallazgos del tech debt audit del 2026-06-12 sobre `getThumbnail` y su route:

1. **`size` sin validar ni acotar** (`src/app/api/photos/[id]/thumbnail/route.ts:15`): `parseInt` del query param va directo a sharp. Un `size=20000` fuerza redimensionados enormes; un valor no numérico produce NaN; y cada valor distinto crea una entrada nueva en la caché de disco — vector de agotamiento de CPU/disco para cualquier sesión autenticada.
2. **Sin deduplicación de generaciones concurrentes** (`src/lib/thumbnail.ts:39-92`): el primer render de un grid lanza decenas de peticiones; si varias piden el mismo thumbnail no cacheado, sharp lo genera N veces y escriben el mismo fichero.

---

## Criterios de aceptación

### Validación de size
- [ ] Solo se aceptan los tamaños que la app usa realmente (whitelist: 100, 120, 150, 200, 300, 400, 420, 600, 1920) — valores no listados se redondean al más cercano
- [ ] `size` no numérico → 400 o fallback al default (400), nunca NaN hacia sharp
- [ ] La validación vive en un único sitio reutilizable (la usan tanto `/api/photos/[id]/thumbnail` como `/api/v1/photos/[id]/thumbnail`)

### Deduplicación in-flight
- [ ] Mapa de promesas en curso por `cacheKey`: peticiones concurrentes del mismo thumbnail comparten una sola generación
- [ ] La entrada del mapa se limpia al resolver o rechazar (sin fugas de memoria)

### Tests
- [ ] Test de la whitelist/redondeo de tamaños
- [ ] Test de dedupe: dos llamadas concurrentes a `getThumbnail` con el mismo key invocan sharp una sola vez

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/thumbnail.ts` | `normalizeThumbnailSize()` + mapa in-flight |
| `src/app/api/photos/[id]/thumbnail/route.ts` | Usar la validación |
| `src/app/api/v1/photos/[id]/thumbnail/route.ts` | Usar la validación |
| `src/lib/config.ts` | `THUMBNAIL_SIZES` como constante |

---

## Notas técnicas

- El redondeo al tamaño más cercano (en vez de 400 fijo) mantiene compatibles los `size` ya emitidos por el frontend y los ETags existentes.
- El mapa in-flight debe ser por proceso (módulo singleton) — suficiente, no hay multi-proceso.

---

## Fuera de alcance (v1)

- Límite global de tamaño de la caché de thumbnails (existe evicción por edad de 30 días)
- Rate limiting por sesión

> Estado: ✅ Desplegada
