# Feature: Detección y gestión de pares RAW+JPEG

## Historia de usuario

Como fotógrafo semi-profesional que dispara en modo RAW+JPEG simultáneamente,
quiero que photoshelf reconozca automáticamente los pares RAW+JPEG del mismo disparo y me permita gestionar qué formato conservar,
para no ver duplicados en mi biblioteca y mantener mi catálogo limpio sin trabajo manual.

---

## Descripción

Las cámaras modernas pueden grabar simultáneamente RAW y JPEG del mismo disparo. Esto genera pares de archivos con el mismo nombre base y distinta extensión (`DSC_0042.ARW` + `DSC_0042.jpg`). En herramientas como Apple Photos, estos se tratan como dos fotos independientes — el usuario los ve duplicados sin serlo.

Esta US añade la detección de pares RAW+JPEG como una categoría propia, diferente de la detección de duplicados exactos de US-003. El criterio de detección es: mismo directorio + mismo nombre base (sin extensión) + una extensión RAW y otra JPEG. Los formatos RAW reconocidos son: `.arw`, `.cr2`, `.cr3`, `.nef`, `.orf`, `.raf`, `.rw2`, `.dng`, `.raw`.

El usuario puede decidir para cada par, o para toda la biblioteca de una vez: mostrar solo el RAW, solo el JPEG, o ambos. La decisión afecta solo a la visibilidad en la biblioteca — ningún archivo se borra del disco.

---

## Criterios de aceptación

### Detección de pares
- [ ] Durante el scan (`scanner.ts`), cuando se indexa un archivo, se comprueba si existe otro archivo con el mismo nombre base y extensión complementaria (RAW↔JPEG) en el mismo directorio
- [ ] Si se detecta un par, ambas fotos se vinculan mediante una nueva columna `raw_pair_id` en la tabla `photos`
- [ ] El escaneo no rompe si los pares no están en el mismo directorio o si falta una de las partes
- [ ] Los pares ya detectados no se recomputados en re-escaneos salvo que cambien los archivos del directorio

### Visibilidad en la biblioteca
- [ ] Existe un ajuste en Configuración: "Mostrar pares RAW+JPEG" con tres opciones:
  - `Ambos` (por defecto actual — no cambia nada)
  - `Solo RAW` — oculta el JPEG cuando existe su par RAW
  - `Solo JPEG` — oculta el RAW cuando existe su par JPEG
- [ ] La preferencia se persiste en la tabla de configuración o en localStorage
- [ ] La opción seleccionada afecta a todos los grids de la app (biblioteca, búsqueda, temáticas, álbumes inteligentes)

### Gestión de pares
- [ ] En la vista de detalle de una foto que tiene par, aparece un badge "RAW+JPEG" con enlace a la foto complementaria
- [ ] Desde el badge se puede abrir el complementario en un modal o navegar a su detalle
- [ ] En las estadísticas de la biblioteca se muestra: "X pares RAW+JPEG detectados"

### Panel de revisión de pares
- [ ] Existe una sección `/tools/raw-pairs` accesible desde el sidebar bajo "Herramientas"
- [ ] Lista todos los pares detectados con miniatura, nombre de archivo RAW, nombre JPEG y tamaños
- [ ] Permite aplicar el ajuste de visibilidad de forma global o por par individual

---

## API necesaria

### `GET /api/raw-pairs`
Lista los pares RAW+JPEG detectados.

```json
{
  "pairs": [
    {
      "raw": { "id": 10, "filename": "DSC_0042.arw", "size_bytes": 24000000 },
      "jpeg": { "id": 11, "filename": "DSC_0042.jpg", "size_bytes": 4200000 }
    }
  ],
  "total": 312
}
```

### `GET /api/photos` (modificado)
Añadir parámetro `raw_visibility: "both" | "raw_only" | "jpeg_only"` que filtra según la preferencia.

---

## Ruta y navegación

- Panel: `/tools/raw-pairs`
- Configuración: `/settings` → sección "Biblioteca" → "Pares RAW+JPEG"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/scanner.ts` | Detección de pares durante indexación |
| `src/lib/db.ts` | Añadir columna `raw_pair_id INTEGER REFERENCES photos(id)` |
| `src/lib/queries/photos.ts` | Filtrado por `raw_visibility` en `listPhotos` |
| `src/app/tools/raw-pairs/page.tsx` | Panel de revisión de pares |
| `src/app/api/raw-pairs/route.ts` | Nuevo — lista de pares |
| `src/app/(library)/[year]/[event]/[photoId]/PhotoDetailClient.tsx` | Badge RAW+JPEG |
| `src/app/settings/page.tsx` | Añadir ajuste de visibilidad |

---

## Notas técnicas

- La detección de pares en el scanner: `path.parse(filename).name` (nombre sin extensión) como clave de agrupación dentro del mismo directorio. Se puede hacer en una segunda pasada sobre los registros del mismo evento recién escaneados.
- Los EXIF de RAW y JPEG pueden diferir ligeramente — conservar los EXIF del RAW como autoritativo si ambos existen.
- Para la query de filtrado: `WHERE (raw_pair_id IS NULL OR :visibility = 'both' OR (ext IN ('arw','cr2',...) AND :visibility = 'raw_only') OR (ext IN ('jpg','jpeg') AND :visibility = 'jpeg_only'))`

---

## Fuera de alcance (v1)

- Borra automático del JPEG cuando se conserva el RAW (demasiado destructivo)
- Detección de pares en distintos directorios
- Vinculación manual de pares cuando los nombres base difieren
- Vista side-by-side RAW vs JPEG para comparar diferencias de procesado in-camera
