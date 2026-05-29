# Feature: Exportar selección de fotos como ZIP

## Historia de usuario

Como fotógrafo que quiere compartir o hacer backup de un subconjunto de fotos,
quiero poder seleccionar varias fotos en la biblioteca y descargarlas todas en un único archivo ZIP,
para no tener que descargarlas una por una o acceder directamente al NAS por SFTP.

---

## Descripción

photoshelf gestiona fotos alojadas en un NAS, pero actualmente solo permite descargar una foto a la vez desde el detalle. Para un caso de uso muy común — "quiero las 15 mejores fotos de las vacaciones de verano para compartirlas con la familia" — el usuario tiene que descargar cada foto individualmente.

Esta feature añade un modo de selección múltiple en la biblioteca y un endpoint de exportación que genera un ZIP con los archivos originales (o los thumbnails de alta resolución, según preferencia). La generación del ZIP ocurre en el servidor con streaming para no cargar toda la biblioteca en memoria.

---

## Criterios de aceptación

### Modo selección múltiple
- [ ] En la biblioteca, al mantener pulsado `Shift` y hacer click en una foto, se activa el modo selección
- [ ] Alternativamente, existe un botón "Seleccionar" en la toolbar de la biblioteca que activa el modo
- [ ] En modo selección, cada foto muestra un checkbox en la esquina superior izquierda
- [ ] Shift+Click selecciona un rango de fotos (entre la primera y la última seleccionada)
- [ ] Un contador "N fotos seleccionadas" es visible en la toolbar mientras hay selección activa
- [ ] El botón "Cancelar selección" o `Escape` limpia la selección y sale del modo

### Exportación ZIP
- [ ] Con al menos 1 foto seleccionada, aparece el botón "Descargar selección" en la toolbar
- [ ] Al pulsarlo, el servidor genera un ZIP con los archivos originales de las fotos seleccionadas
- [ ] El archivo ZIP se llama `photoshelf-{fecha}.zip`
- [ ] La descarga usa streaming — el ZIP se genera y envía al cliente de forma incremental, sin cargar todos los archivos en memoria simultáneamente
- [ ] Si algún archivo no es accesible (movido o eliminado del NAS), se omite con un log de advertencia — no se aborta el ZIP

### Feedback al usuario
- [ ] Durante la generación del ZIP, se muestra un indicador de progreso ("Preparando N fotos…")
- [ ] Si la selección supera 200 fotos, se muestra una advertencia antes de iniciar la descarga
- [ ] Si la descarga falla (error del servidor), se muestra un toast de error

---

## API necesaria

| Endpoint | Método | Descripción |
|---|---|---|
| `POST /api/photos/export` | POST | Genera y devuelve ZIP streaming de las fotos indicadas |

Body: `{ photoIds: number[] }`
Response: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="photoshelf-YYYY-MM-DD.zip"`, body en streaming.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/photos/export/route.ts` | Nuevo — genera ZIP streaming con `archiver` o `fflate` |
| `src/components/PhotoGrid.tsx` | Modo selección con checkboxes y eventos de Shift+Click |
| `src/app/library/LibraryClient.tsx` | Toolbar de selección con contador y botón de exportar |
| `src/lib/queries/photos.ts` | `getPhotosByIds(ids: number[]): Photo[]` — nueva función de repositorio |

---

## Notas técnicas

- Para el ZIP en streaming usar `archiver` (npm) que soporta `archiver.pipe(response)`. Alternativamente, `fflate` es pure-JS y más ligero.
- El endpoint debe verificar que todos los `photoIds` pertenecen al catálogo activo del usuario (evitar exfiltración entre catálogos).
- Limitar a máximo 500 fotos por petición para proteger el servidor de peticiones abusivas.
- El modo de selección es solo estado en cliente (`useState`) — no requiere persistencia en BD.
- Los archivos originales se obtienen con `resolvePhotoPath(photo.path)` — ya protegido contra path traversal.

---

## Fuera de alcance (v1)

- Exportar como thumbnails en lugar de originales (opción de calidad)
- Exportar metadatos como CSV junto con las fotos
- Crear un proyecto de fotos a partir de la selección (integrar con la feature de proyectos)
- Descarga asíncrona con notificación cuando el ZIP esté listo (para selecciones muy grandes)
