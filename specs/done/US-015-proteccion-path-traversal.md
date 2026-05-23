# Feature: Protección de path traversal en acceso a archivos

> **Estado: ✅ Desplegada** — merged en main el 2026-05-23 (PR #34)

## Historia de usuario

Como administrador de photoshelf,
quiero que la app no pueda ser engañada para leer archivos fuera del directorio de fotos,
para que un atacante no pueda acceder a ficheros del sistema del NAS a través de la API.

---

## Descripción

Los endpoints que sirven archivos de foto (`/api/photos/[id]/thumbnail` y
`/api/photos/[id]/original`) construyen la ruta del archivo a partir del campo `path`
almacenado en SQLite. Si un atacante logra insertar un valor malicioso en la DB
(p. ej. `../../etc/passwd`), podría hacer que el servidor leyera archivos del sistema.

Esta US centraliza la validación de rutas en una función `resolvePhotoPath()` que garantiza
que el archivo resultante esté siempre dentro del directorio raíz de fotos.

---

## Criterios de aceptación

### Función centralizada `resolvePhotoPath`
- [ ] Existe `src/lib/config.ts` con la función `resolvePhotoPath(relativePath, photosRoot)`
- [ ] La función usa `path.resolve()` para canonicalizar la ruta (elimina `..`, symlinks, etc.)
- [ ] Si la ruta resuelta no empieza por `photosRoot + path.sep`, lanza `Error('Path traversal detected')`
- [ ] La función acepta que `absPath === root` (sin el sep) para evitar falsos positivos

### Aplicación en todos los endpoints de archivo
- [ ] `src/lib/thumbnail.ts` usa `resolvePhotoPath` en lugar de `path.join` directo
- [ ] `src/app/api/photos/[id]/original/route.ts` usa `resolvePhotoPath` con try/catch → 403
- [ ] `src/lib/ollama.ts` (`readPhotoAsJpegBase64`) usa `resolvePhotoPath`
- [ ] Ningún endpoint de archivo construye rutas absolutas sin pasar por `resolvePhotoPath`

### Respuestas de error
- [ ] Intento de path traversal en `/thumbnail` devuelve HTTP 403 con `{ error: 'Access denied' }`
- [ ] Intento de path traversal en `/original` devuelve HTTP 403 con `{ error: 'Access denied' }`
- [ ] El intento se loguea en `console.error` con el ID de foto afectado

### Protección de prompt injection en IA
- [ ] Existe `escapeXml()` en `src/lib/ollama.ts` que escapa `& < > " '`
- [ ] Los campos controlados por usuario (`concept`, `prompt`) se escapan antes de incluirse en prompts Ollama
- [ ] El campo de búsqueda en `/api/ai/search` se trunca a 200 caracteres antes de procesarse

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/config.ts` | Nuevo — `resolvePhotoPath()` centralizada |
| `src/lib/thumbnail.ts` | Usar `resolvePhotoPath`, importar desde config |
| `src/lib/ollama.ts` | `escapeXml()`, `resolvePhotoPath`, sanitización del prompt |
| `src/app/api/photos/[id]/original/route.ts` | `resolvePhotoPath` con 403 en traversal |
| `src/app/api/photos/[id]/thumbnail/route.ts` | Try/catch → 403 en traversal |
| `src/app/api/ai/search/route.ts` | Truncar prompt a 200 chars |

---

## Notas técnicas

- `path.resolve(root, relativePath)` ya maneja `..` en `relativePath` — no necesitamos sanitizarlo manualmente
- El check debe ser `startsWith(root + path.sep)` y no `startsWith(root)` para evitar falsos positivos
  con rutas como `/photos-extra/file.jpg` cuando el root es `/photos`
- En tests, usar paths absolutos temporales (p. ej. `os.tmpdir()`) para verificar el comportamiento

---

## Fuera de alcance (v1)

- Validación de que el archivo es realmente una imagen (magic bytes)
- Sandbox de proceso con seccomp/AppArmor
- Audit log de accesos a archivos
