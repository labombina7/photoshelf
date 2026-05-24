# Feature: US-009d — Escaneo vinculado a catálogo específico

## Historia de usuario

Como usuario de photoshelf con múltiples catálogos,
quiero que al ejecutar el escáner, las fotos se indexen en el catálogo activo,
para que cada catálogo tenga sus propias fotos sin mezclarlas.

---

## Descripción

El escáner actual (`/api/scan`) lee `PHOTOS_PATH` del entorno y escanea esa carpeta.
Con múltiples catálogos, cada catálogo tiene su propio `path`. Esta US adapta el escáner
para que use la ruta del catálogo activo y asigne el `catalog_id` correcto a las fotos indexadas.

---

## Criterios de aceptación

### Escaneo por catálogo
- [ ] `POST /api/scan` lee el catálogo activo (de la sesión) y usa `catalog.path` como directorio a escanear
- [ ] Todas las fotos insertadas durante el scan tienen `catalog_id` del catálogo activo
- [ ] El scan no toca fotos de otros catálogos (condición WHERE en UPDATE/DELETE)

### Re-escaneo seguro
- [ ] Si se re-escanea un catálogo, sólo se actualizan/eliminan las fotos de ese `catalog_id`
- [ ] Las fotos de otros catálogos no se ven afectadas

### Validación
- [ ] Si el `catalog.path` no existe en disco, el endpoint devuelve un error descriptivo
- [ ] El endpoint valida que `catalog.path` está dentro de los límites permitidos
  (usando `resolvePhotoPath` o validación equivalente)

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/app/api/scan/route.ts` | Leer catálogo activo, pasar `catalog_id` y `path` al scanner |
| `src/lib/scanner.ts` | Aceptar `catalogId` como parámetro, insertarlo en todas las fotos |

---

## Fuera de alcance

- Escaneo de múltiples catálogos en paralelo
- UI para seleccionar qué catálogo escanear (el activo es el que se escanea)
