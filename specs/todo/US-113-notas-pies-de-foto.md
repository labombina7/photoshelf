# Feature: Notas y pies de foto con búsqueda

## Historia de usuario

Como fotógrafo que documenta su archivo,
quiero añadir una nota o pie de foto a cualquier imagen,
para registrar contexto que los tags no capturan (quién aparece, qué pasó, dónde exactamente) y reencontrarlo después buscando.

---

## Descripción

Los tags describen contenido en vocabulario controlado; las temáticas agrupan. Pero el contexto narrativo — «la abuela en su 90 cumpleaños, justo antes del brindis» — no tiene hoy dónde vivir. Es información que se pierde con los años y que más valor tiene en un archivo personal.

Esta feature añade un campo de nota libre por foto, editable desde el DetailPanel (desktop y bottom sheet móvil). Las notas se integran en la búsqueda unificada del header: la intención `text`/fulltext busca también sobre notas, y los resultados las destacan. En el visor de detalle la nota se muestra bajo los metadatos; en el slideshow puede mostrarse como caption opcional.

Cambio de esquema mínimo (columna `caption TEXT` en `photos` con migración idempotente) y se incluye en el backup JSON como dato curado irrecuperable.

---

## Criterios de aceptación

### Edición
- [ ] Textarea de nota en el DetailPanel con autosave (debounce) y indicador de guardado
- [ ] Límite razonable (2000 caracteres) validado en cliente y servidor
- [ ] Funciona igual en desktop y en el bottom sheet móvil

### Búsqueda
- [ ] La búsqueda fulltext incluye `caption` (además de filename) en `/api/search`
- [ ] Los resultados con match en nota muestran un snippet de la nota
- [ ] Los hints del clasificador de intención no cambian (la nota entra por la rama fulltext)

### Visualización
- [ ] La nota se muestra en el detalle de la foto (desktop y móvil)
- [ ] Toggle «Mostrar pies de foto» en el slideshow (off por defecto)

### Persistencia
- [ ] Migración idempotente `ALTER TABLE photos ADD COLUMN caption TEXT`
- [ ] Las notas se incluyen en el export JSON del backup (`backup.ts`)

---

## API necesaria

- `PATCH /api/photos/[id]` — aceptar `{ caption: string }` (endpoint existente, campo nuevo)
- `/api/search` — incluir caption en la rama fulltext

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/DetailPanel.tsx` | Sección de nota con autosave |
| `src/lib/db.ts` | Migración de columna |
| `src/lib/queries/photos.ts` | Update de caption |
| `src/lib/queries/search.ts` | Fulltext sobre caption |
| `src/components/Slideshow.tsx` | Caption opcional |
| `src/lib/backup.ts` | Incluir captions en el export |

---

## Notas técnicas

- Para bibliotecas grandes, `LIKE '%…%'` sobre caption es aceptable al inicio; si la búsqueda se resiente, migrar a FTS5 (SQLite lo trae compilado en better-sqlite3) como mejora posterior.
- El autosave debe seguir el patrón optimista con revert de US-099 (no introducir un cuarto patrón de guardado).

---

## Fuera de alcance (v1)

- Escritura de la nota en el EXIF/XMP del fichero original (la app no modifica originales)
- Notas generadas por IA (encaja mejor con el módulo de memorias)
- Markdown o formato enriquecido
