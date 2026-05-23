# Feature: Hardening técnico — gestión de errores y tipos

## Historia de usuario

Como desarrollador de photoshelf,
quiero que todas las rutas API devuelvan errores estructurados y que los tipos TypeScript sean coherentes entre servidor y cliente,
para detectar problemas rápidamente en logs y eliminar la deuda de tipos duplicados e interfaces incoherentes.

---

## Descripción

Esta US agrupa los hallazgos de deuda técnica de severidad 🟡 Media que tienen un fix concreto y bien definido en las categorías de gestión de errores y tipos TypeScript. Aunque ninguno es crítico individualmente, en conjunto generan un código más frágil y más difícil de depurar.

Las rutas API sin try/catch hacen que errores de DB resulten en respuestas 500 con stack trace expuesto en development. Las interfaces `EventGroup`, `ScanState` y `WatcherState` duplicadas entre servidor y cliente son fuentes de divergencia silenciosa. La operación síncrona `fs.existsSync` bloquea el event loop. Los tipos `any` en MapClient impiden detectar cambios de API del plugin de Leaflet.

---

## Criterios de aceptación

### Try/catch en rutas API para errores de DB
- [ ] Las rutas API que ejecutan queries SQLite y actualmente no tienen try/catch lo añaden: `src/app/api/themes/route.ts`, `src/app/api/tags/[photoId]/route.ts`, y cualquier otra ruta identificada durante la implementación
- [ ] Los errores de DB se capturan y devuelven como `{ error: 'Database error', details: process.env.NODE_ENV === 'development' ? err.message : undefined }` con HTTP 500
- [ ] No se expone el stack trace de SQLite en producción (`NODE_ENV !== 'development'`)
- [ ] Los errores se loguean con `console.error('[api]', route, err)` para trazabilidad

### `fs.existsSync` → async en original/route.ts
- [ ] `src/app/api/photos/[id]/original/route.ts` reemplaza `fs.existsSync(absPath)` con `await fs.promises.access(absPath).then(() => true).catch(() => false)`
- [ ] La lógica posterior (servir el archivo o devolver 404) sigue siendo equivalente

### Unificación de interfaces duplicadas
- [ ] `EventGroup` se define una sola vez en `src/lib/types.ts` con todos los campos posibles (usando `?` para los opcionales: `count?: number`, `thumbnail_id?: number`, `photos?: Photo[]`)
- [ ] Los componentes que redefinían `EventGroup` localmente importan desde `src/lib/types.ts`
- [ ] `ScanState` se exporta únicamente desde `src/lib/scanState.ts` y `src/components/ScanProvider.tsx` la importa con `import type`
- [ ] `WatcherState` se exporta únicamente desde `src/lib/watcherState.ts` y `ScanProvider.tsx` la importa con `import type`

### Tipos de MapClient — eliminar `as any` en Leaflet
- [ ] Se crea un tipo local para la extensión de markerClusterGroup:
  ```typescript
  type LeafletWithCluster = typeof L & {
    markerClusterGroup: (options?: object) => L.FeatureGroup;
  };
  ```
- [ ] Se usa `(L as LeafletWithCluster).markerClusterGroup(...)` en lugar de `(L as any)`
- [ ] Se elimina el comentario `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

### MIME types completos en original/route.ts
- [ ] Se crea un mapa completo de extensiones a Content-Type en el archivo o en `config.ts`:
  ```typescript
  const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.heic': 'image/heic',
    '.heif': 'image/heif', '.tif': 'image/tiff',
    '.tiff': 'image/tiff', '.avif': 'image/avif',
  };
  ```
- [ ] El fallback sigue siendo `'image/jpeg'` para formatos desconocidos

### Comentarios de workaround
- [ ] `src/lib/thumbnail.ts` donde hay `raw as unknown as ArrayBuffer` tiene un comentario: `// WORKAROUND: heic-convert returns Buffer but type expects ArrayBuffer — remove if heic-convert updates types`
- [ ] `src/app/map/MapClient.tsx` donde hay `(marker as unknown as { _photoData: PhotoPoint })` tiene un comentario: `// WORKAROUND: Leaflet marker type doesn't expose custom data — replace with proper Leaflet.extend when available`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/themes/route.ts` | Añadir try/catch para errores de DB |
| `src/app/api/tags/[photoId]/route.ts` | Añadir try/catch para errores de DB |
| `src/app/api/photos/[id]/original/route.ts` | `existsSync` → async, MIME types completos |
| `src/lib/types.ts` | Unificar `EventGroup` con campos opcionales |
| `src/app/library/LibraryClient.tsx` | Importar `EventGroup` desde `types.ts` |
| `src/components/PhotoGrid.tsx` | Importar `EventGroup` desde `types.ts` |
| `src/lib/scanState.ts` | Exportar `ScanState` |
| `src/lib/watcherState.ts` | Exportar `WatcherState` |
| `src/components/ScanProvider.tsx` | Importar `ScanState` y `WatcherState` de lib |
| `src/app/map/MapClient.tsx` | Tipo local para Leaflet cluster, eliminar `as any` |
| `src/lib/thumbnail.ts` | Comentario de workaround |

---

## Notas técnicas

- Al unificar `EventGroup`, hay que revisar qué campos usa cada componente para asegurarse de que la interfaz unificada los cubre todos. Los campos `count` y `thumbnail_id` son específicos del API de grupos; `photos` es para la vista expandida.
- La eliminación de `as any` en MapClient puede revelar errores de tipo que hay que resolver. Si `markerClusterGroup` devuelve un tipo no compatible con `L.FeatureGroup`, puede ser necesario usar `L.Layer` como tipo más genérico.
- Para el try/catch en rutas API, auditar todas las rutas en `src/app/api/` durante la implementación — no solo las dos mencionadas explícitamente.

---

## Fuera de alcance (v1)

- Añadir un middleware global de manejo de errores HTTP (puede hacerse con `next.config.ts` o un wrapper)
- Logging estructurado con una librería dedicada (winston, pino)
- Añadir `@types/leaflet.markercluster` como dependencia de desarrollo
- Tipar completamente `exifr` con tipos importados del paquete
