# Feature: Cobertura de tests para funciones críticas

## Historia de usuario

Como desarrollador de photoshelf,
quiero que las funciones críticas de escaneo, thumbnails y las rutas API principales tengan tests unitarios y de integración,
para detectar regresiones en el siguiente refactoring o actualización de dependencias.

---

## Descripción

photoshelf carece de cobertura de tests en las funciones más críticas de la aplicación. `scanner.ts` y `thumbnail.ts` no tienen ningún test; si un refactoring introduce un bug en el parsing de EXIF o en la generación de thumbnails, no habrá ninguna red de seguridad. Los tests existentes de `ollama.test.ts` reimplementan las funciones localmente en lugar de importarlas, por lo que no detectarían regresiones en el código real.

Esta US establece la cobertura mínima necesaria en las tres áreas identificadas como más críticas, usando el stack de testing ya configurado (Vitest + mocks).

---

## Criterios de aceptación

### Tests para scanner.ts
- [ ] Existe el archivo `src/__tests__/scanner.test.ts`
- [ ] Tests para `extractExif()`:
  - [ ] Archivo con EXIF completo (fecha, GPS, dimensiones) devuelve los valores correctos
  - [ ] Archivo sin EXIF devuelve `null` para fecha y GPS en lugar de lanzar error
  - [ ] Fecha malformada (string no parseble) devuelve `null` para `taken_at`
  - [ ] GPS con valores negativos (hemisferio S/O) se almacena correctamente
  - [ ] Archivo HEIC con EXIF devuelve los mismos campos que un JPEG
- [ ] Tests para `scanLibrary()` (con mock de fs y DB):
  - [ ] Archivos nuevos se insertan en la DB
  - [ ] Archivos ya existentes no se duplican (upsert correcto)
  - [ ] Archivos con rutas que contienen caracteres especiales (tildes, espacios) se manejan sin error
  - [ ] El progreso se actualiza correctamente durante el scan

### Tests para thumbnail.ts
- [ ] Existe el archivo `src/__tests__/thumbnail.test.ts`
- [ ] Tests para `getThumbnail()`:
  - [ ] Cache hit: si el thumbnail existe en `CACHE_PATH`, se devuelve sin llamar a sharp
  - [ ] Cache miss: si no existe, se genera el thumbnail y se guarda en cache
  - [ ] El directorio de cache se crea si no existe
  - [ ] Para archivos HEIC, se ejecuta la conversión antes de pasar a sharp
  - [ ] Tamaños distintos (120, 400, 800) generan archivos de cache distintos
- [ ] Los mocks de `fs` y `sharp` son suficientes — no se accede al sistema de archivos real en los tests

### Refactoring de ollama.test.ts
- [ ] Las funciones puras de parseo en `src/lib/ollama.ts` se exportan explícitamente:
  - `parseSearchResponse(response: string): PhotoMatch[]`
  - `parseClassifyTags(response: string): string[]`
  - `parseReviewResponse(response: string): ReviewResult`
- [ ] `src/__tests__/ollama.test.ts` importa estas funciones directamente desde `src/lib/ollama.ts` en lugar de reimplementarlas
- [ ] Los tests cubren los mismos casos que antes pero ahora prueban el código real
- [ ] Si la implementación en `ollama.ts` cambia, los tests fallan (regresión detectada)

### Tests de integración para rutas API críticas
- [ ] Existe `src/__tests__/api.test.ts` (o archivos separados por ruta)
- [ ] Test para `POST /api/auth/login`:
  - [ ] Password correcta → sesión creada, HTTP 200
  - [ ] Password incorrecta → HTTP 401
  - [ ] Rate limiting (si US-014 ya implementada): más de 10 intentos → HTTP 429
- [ ] Test para `GET /api/photos` con mock de `getDb()`:
  - [ ] Sin filtros → devuelve lista de fotos
  - [ ] Con filtro `year` → solo fotos de ese año
  - [ ] Con filtro `tag` → solo fotos con ese tag

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/__tests__/scanner.test.ts` | Nuevo — tests para extractExif y scanLibrary |
| `src/__tests__/thumbnail.test.ts` | Nuevo — tests para getThumbnail con mocks de fs/sharp |
| `src/__tests__/ollama.test.ts` | Refactorizar para importar funciones reales |
| `src/lib/ollama.ts` | Exportar funciones de parseo (`parseSearchResponse`, etc.) |
| `src/__tests__/api.test.ts` | Nuevo — tests de integración para login y photos API |

---

## Notas técnicas

- Usar `vi.mock('exifr')` para simular distintos outputs de EXIF sin acceder a archivos reales
- Usar `vi.mock('sharp')` para evitar procesado real de imágenes — el mock debe devolver un objeto con los métodos `resize`, `webp`, `jpeg`, `toBuffer`, `toFile` encadenables
- `vi.mock('fs/promises')` para simular existencia/ausencia del cache de thumbnails
- Para los tests de integración, se puede testear directamente las funciones `GET`/`POST` exportadas por las rutas Next.js usando `new Request(url, options)` — Next.js 14 App Router exporta los handlers directamente
- La cobertura de `scanLibrary` con mocks de DB es más compleja; empezar con `extractExif` como función pura, que es la más crítica y la más fácil de testear

---

## Fuera de alcance (v1)

- Tests E2E con Playwright o Cypress
- Cobertura de todas las rutas API (solo las tres más críticas en v1)
- CI con umbral mínimo de cobertura (se puede añadir como seguimiento)
- Tests para `folderWatcher.ts` (identificado como siguiente paso en la deuda técnica)
