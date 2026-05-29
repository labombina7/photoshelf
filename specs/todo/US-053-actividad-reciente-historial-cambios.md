# Feature: Panel de actividad reciente — historial de cambios en la biblioteca

## Historia de usuario

Como fotógrafo que gestiona activamente su biblioteca con etiquetas y clasificaciones,
quiero ver un registro de las últimas acciones realizadas (fotos añadidas, etiquetas aplicadas, clasificaciones completadas),
para poder deshacer cambios accidentales, revisar qué hizo la IA en la última sesión y retomar el trabajo donde lo dejé.

---

## Descripción

Actualmente photoshelf no registra ningún historial de acciones. Si la clasificación automática genera tags incorrectos en 200 fotos, el usuario no tiene forma de ver qué cambió ni de revertirlo de forma masiva. Tampoco puede saber fácilmente qué fotos se añadieron en el último escaneo.

Esta feature añade un registro ligero de actividad en SQLite y un panel de "Actividad reciente" accesible desde el sidebar o el header. El historial muestra las acciones más relevantes de las últimas 2 semanas: fotos escaneadas, clasificaciones completadas, etiquetas añadidas/eliminadas, favoritos marcados.

El alcance es de solo-lectura en v1: el usuario puede ver el historial pero no hay undo/redo todavía.

---

## Criterios de aceptación

### Registro de actividad
- [ ] Nueva tabla `activity_log` en SQLite: `id, action_type, entity_type, entity_id, metadata JSON, created_at`
- [ ] Se registran las siguientes acciones:
  - `scan_completed` — escaneo finalizado (metadata: fotos añadidas, eliminadas, tiempo)
  - `classify_completed` — clasificación finalizada (metadata: fotos procesadas, tags añadidos)
  - `tag_added` — tag añadido manualmente a una foto (manual)
  - `tag_removed` — tag eliminado de una foto
  - `favorite_toggled` — foto marcada/desmarcada como favorita
  - `project_created` — proyecto creado (metadata: título, número de fotos)
- [ ] Las entradas de `activity_log` se purgan automáticamente cuando tienen más de 30 días
- [ ] La escritura en `activity_log` es no bloqueante (no retarda las operaciones principales)

### Panel de actividad
- [ ] Existe una vista "Actividad" accesible desde el sidebar o desde el icono de notificaciones en el header
- [ ] La vista muestra las últimas N acciones (paginadas, default 50)
- [ ] Cada entrada muestra: tipo de acción (icono), descripción en lenguaje natural, fecha relativa ("hace 2 horas")
- [ ] Las entradas de escaneo y clasificación muestran un resumen: "Escaneo completado — 47 fotos nuevas, 2 eliminadas"
- [ ] Las entradas de tag muestran la foto miniatura y el nombre del tag

### Filtros del historial
- [ ] El usuario puede filtrar por tipo de acción (todos / solo escaneos / solo etiquetas / solo favoritos)
- [ ] El usuario puede filtrar por fecha: "hoy", "esta semana", "este mes"

---

## API necesaria

| Endpoint | Método | Descripción |
|---|---|---|
| `GET /api/activity` | GET | Lista de entradas de actividad paginadas |

Query params: `type` (filtro por tipo), `from` / `to` (rango de fechas), `limit`, `offset`

---

## Ruta y navegación

- Nueva sección: `src/app/activity/page.tsx`
- Añadir enlace en el sidebar (debajo de Estadísticas) o un icono de notificaciones en el header con badge de nuevas acciones

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/activity/page.tsx` | Nuevo — página de actividad reciente |
| `src/app/activity/ActivityClient.tsx` | Nuevo — lista paginada con filtros |
| `src/app/api/activity/route.ts` | Nuevo — endpoint de actividad |
| `src/lib/queries/activity.ts` | Nuevo — `logActivity()`, `getActivity(filters)`, `purgeOldActivity()` |
| `src/lib/db.ts` | Añadir tabla `activity_log` al schema de inicialización |
| `src/lib/scanner.ts` | Llamar a `logActivity('scan_completed', ...)` al finalizar |
| `src/components/ScanProvider.tsx` | Llamar a `logActivity` al recibir el evento de scan completado |
| `src/components/DetailPanel.tsx` | Llamar a `logActivity` en `addTag`, `removeTag`, `toggleFavorite` |
| `src/components/Sidebar.tsx` | Añadir enlace a "Actividad" |

---

## Notas técnicas

- La tabla `activity_log` debería estar en la misma BD SQLite existente — no requiere una BD separada
- `logActivity()` debería ser una llamada fire-and-forget que no bloquee el flujo principal: `void logActivity(...)` o dentro de `after()` en los route handlers
- La purga automática de entradas antiguas puede hacerse al arrancar el servidor (en `instrumentation.ts`) o como efecto secundario de cada escritura (si hay > N entradas, eliminar las más antiguas)
- La descripción en lenguaje natural de cada acción se puede generar en el cliente a partir de `action_type` y `metadata` — no necesita almacenarse

---

## Fuera de alcance (v1)

- Undo/redo de acciones (requiere arquitectura de eventos más compleja)
- Notificaciones push al completar una clasificación
- Exportar el historial como CSV
- Historial multi-usuario (solo aplica cuando haya autenticación multi-usuario)
