# Feature: Protección contra path traversal en acceso a archivos

## Historia de usuario

Como operador de photoshelf,
quiero que la app valide que todos los accesos al sistema de archivos se limiten estrictamente a la carpeta de fotos configurada,
para que un potencial bug de inserción o una manipulación de la base de datos no permita leer archivos arbitrarios del sistema.

---

## Descripción

Las rutas API que sirven imágenes originales, generan thumbnails y envían fotos a Ollama construyen la ruta del archivo uniendo `PHOTOS_PATH` con el campo `path` recuperado de la base de datos. Aunque los paths son insertados por el escáner (no directamente por el usuario), si un atacante consiguiera escribir en la DB o explotar un bug de inserción, podría usar paths relativos con `../` para leer archivos fuera de la carpeta de fotos.

La solución es añadir una validación explícita antes de cualquier acceso al sistema de archivos: verificar que la ruta absoluta resultante comience con la ruta absoluta de `PHOTOS_PATH`. Esta validación también protege contra symlinks relativos mal resueltos.

---

## Criterios de aceptación

### Función de validación centralizada
- [ ] Se crea la función `resolvePhotoPath(relativePath: string, photosRoot: string): string` en `src/lib/config.ts`
- [ ] La función usa `path.resolve(photosRoot, relativePath)` para normalizar la ruta (resuelve `..`, `.`, symlinks relativos)
- [ ] Si la ruta resultante no comienza con `path.resolve(photosRoot)` (con trailing slash), lanza `new Error('Path traversal detected')`
- [ ] La función retorna la ruta absoluta validada para uso posterior

### Aplicación en rutas de API
- [ ] `src/app/api/photos/[id]/original/route.ts` usa `resolvePhotoPath` antes de `fs.existsSync` / `fs.createReadStream`
- [ ] `src/lib/thumbnail.ts` usa `resolvePhotoPath` antes de abrir el archivo con sharp o heic-convert
- [ ] `src/lib/ollama.ts` usa `resolvePhotoPath` antes de leer el archivo para convertir a JPEG

### Respuesta de error correcta
- [ ] Si `resolvePhotoPath` lanza error, la ruta API devuelve HTTP 403 con body `{ error: 'Access denied' }`
- [ ] El error se loguea en el servidor con `console.error('[security] Path traversal attempt:', path)` para trazabilidad
- [ ] No se expone la ruta del archivo ni el mensaje de error interno al cliente

### Reemplazo de `fs.existsSync` por versión async
- [ ] `src/app/api/photos/[id]/original/route.ts` reemplaza `fs.existsSync(absPath)` con `await fs.promises.access(absPath).then(() => true).catch(() => false)` para no bloquear el event loop

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/config.ts` | Nueva función `resolvePhotoPath(relativePath, photosRoot)` con validación |
| `src/app/api/photos/[id]/original/route.ts` | Usar `resolvePhotoPath`, reemplazar `existsSync` por async |
| `src/lib/thumbnail.ts` | Usar `resolvePhotoPath` antes del acceso a archivos |
| `src/lib/ollama.ts` | Usar `resolvePhotoPath` antes de leer la foto |

---

## Notas técnicas

- `path.resolve(photosRoot)` sin trailing slash puede tener falsos positivos si `photosRoot` es `/photos` y hay un archivo en `/photos-extra/secret.txt`. La comprobación debe ser `absPath.startsWith(path.resolve(photosRoot) + path.sep)` o `absPath === path.resolve(photosRoot)`.
- Si `src/lib/config.ts` no existe todavía, crearlo como módulo de configuración central (también útil para la US de centralización de código duplicado).
- En Docker, `PHOTOS_PATH` suele ser `/photos` (un volumen montado). `path.resolve('/photos')` ya devuelve `/photos`; el trailing slash check evita confusión con otras rutas que empiecen igual.
- Los tests deben cubrir: ruta válida dentro de PHOTOS_PATH, ruta con `../` que intenta salir, ruta absoluta distinta.

---

## Fuera de alcance (v1)

- Validación de que el archivo es efectivamente una imagen (por MIME type, no por extensión)
- Restricción adicional por tipo de archivo (ej. solo `.jpg`, `.heic`, `.png`, `.tiff`, `.webp`, `.raw`)
- Sandboxing del proceso de Node.js a nivel de sistema operativo
