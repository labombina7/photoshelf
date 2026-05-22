# Feature: Detección de Duplicados

## Historia de usuario

Como fotógrafo con una biblioteca grande acumulada durante años,
quiero detectar y gestionar fotos duplicadas o casi idénticas,
para liberar espacio en disco y mantener la biblioteca limpia sin trabajo manual.

---

## Descripción

Una herramienta accesible desde el sidebar o los ajustes llamada **"Duplicados"**. Analiza la biblioteca en busca de fotos idénticas (mismo hash de archivo) o muy similares (mismas dimensiones y tamaño en bytes dentro de un umbral). Presenta los grupos de duplicados en una interfaz de comparación donde el usuario elige cuál conservar y cuáles eliminar o mover.

El análisis ocurre en dos fases. Primero se detectan duplicados exactos comparando `size_bytes + width + height + filename` (sin coste computacional). Opcionalmente, una segunda fase calcula el hash SHA-256 del archivo original para confirmar identidad byte a byte. No se usa IA ni procesado visual pesado: pure SQLite + Node.js `crypto`.

El sistema **nunca borra físicamente** los archivos originales por defecto. La acción "eliminar" solo borra el registro de la base de datos y mueve el archivo a una carpeta `_trash/` dentro del directorio de fotos, desde donde el usuario puede recuperarlos manualmente.

---

## Criterios de aceptación

### Análisis
- [ ] Botón "Buscar duplicados" lanza el análisis en background con estado de progreso
- [ ] Fase 1 (rápida): agrupa por `size_bytes + width + height`, reporta candidatos
- [ ] Fase 2 (verificación): calcula SHA-256 de los archivos para confirmar identidad
- [ ] El análisis respeta el mismo patrón de estado que `/api/scan` (estado persistente, no relanza si ya corre)
- [ ] Resultados persistidos en una tabla `duplicate_groups` para evitar reanálisis al recargar

### Presentación de resultados
- [ ] Vista en grid de grupos: cada grupo muestra las N fotos duplicadas juntas
- [ ] Para cada grupo se indica: número de copias, tamaño total que se liberaría, fecha
- [ ] Contador global: "X grupos · Y fotos redundantes · Z MB liberables"
- [ ] Grupos ordenados por tamaño total descendente (los más grandes primero)

### Resolución por grupo
- [ ] En cada grupo, el usuario puede marcar una foto como "conservar" (badge verde)
- [ ] Las demás quedan marcadas como "eliminar" por defecto (badge rojo), pero esto es reversible
- [ ] Botón "Conservar la más reciente" selecciona automáticamente por `taken_at DESC`
- [ ] Botón "Conservar la de mayor resolución" selecciona por `width * height DESC`
- [ ] Al confirmar, las fotos marcadas como "eliminar" se mueven a `_trash/` y se borran de la DB

### Seguridad
- [ ] Nunca se puede confirmar sin tener exactamente 1 foto marcada como "conservar" por grupo
- [ ] Modal de confirmación muestra el número de archivos que se moverán a `_trash/`
- [ ] Acción deshacer no disponible — la UI lo indica claramente antes de confirmar
- [ ] Si el archivo ya no existe en disco, el registro se marca como "huérfano" y se gestiona por separado

### Persistencia del estado
- [ ] Los resultados del último análisis persisten al recargar la página
- [ ] Un botón "Nuevo análisis" descarta los resultados anteriores y lanza uno fresco
- [ ] Si se ha completado la resolución de todos los grupos, aparece el mensaje "Sin duplicados detectados"

---

## API necesaria

### `POST /api/duplicates/scan`
Lanza el análisis en background. Retorna error 409 si ya hay uno en curso.

### `GET /api/duplicates/status`
Estado del análisis: `{ running, progress, total, found }`.

### `GET /api/duplicates`
Devuelve los grupos de duplicados con sus fotos.

```json
{
  "groups": [
    {
      "id": 1,
      "count": 3,
      "size_bytes": 15728640,
      "photos": [
        { "id": 10, "filename": "...", "path": "...", "taken_at": "...", "width": 4000, "height": 3000 }
      ]
    }
  ],
  "totalGroups": 12,
  "totalBytes": 94371840
}
```

### `POST /api/duplicates/resolve`
Recibe `{ groupId, keepPhotoId }`. Mueve el resto a `_trash/` y elimina de la DB.

---

## Ruta y navegación

- Ruta: `/duplicates`
- Enlace en sidebar bajo una nueva sección "Herramientas" (o en el menú de ajustes)
- Icono: `IconDuplicate` (dos páginas superpuestas)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/duplicates/page.tsx` | Server component — carga resultados persistidos |
| `src/app/duplicates/DuplicatesClient.tsx` | Client component — grupos, selección, confirmación |
| `src/app/api/duplicates/scan/route.ts` | Lanza análisis background |
| `src/app/api/duplicates/status/route.ts` | Estado del análisis |
| `src/app/api/duplicates/route.ts` | GET grupos persistidos |
| `src/app/api/duplicates/resolve/route.ts` | POST para confirmar resolución |
| `src/lib/duplicateScanner.ts` | Lógica de análisis (SHA-256, agrupación) |
| `src/lib/db.ts` | Añadir tabla `duplicate_groups` y `duplicate_photos` |
| `src/components/Icons.tsx` | Añadir `IconDuplicate` |
| `src/components/Sidebar.tsx` | Nuevo enlace "Duplicados" |

---

## Notas técnicas

- El hash SHA-256 se calcula con `crypto.createHash('sha256')` sobre un stream del archivo original, sin cargar todo en memoria
- La tabla `duplicate_groups` almacena `hash`, `size_bytes`, `count` y `resolved_at` para persistencia
- Mover a `_trash/` usa `fs.renameSync`; si está en distinto filesystem, fallback a copy+delete
- El análisis por fases usa el mismo patrón de estado en memoria que `scanState.ts`

---

## Fuera de alcance (v1)

- Comparación perceptual (imágenes visualmente similares pero con distintos metadatos)
- Recuperar archivos desde la papelera dentro de la propia app
- Detección de duplicados entre eventos o años distintos filtrada por criterio
- Borrado físico permanente desde la UI
