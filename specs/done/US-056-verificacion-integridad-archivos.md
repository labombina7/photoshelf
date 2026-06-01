> Estado: ✅ Desplegada

# Feature: Verificación de integridad y salud de archivos

## Historia de usuario

Como fotógrafo con años de fotos acumuladas en disco,
quiero saber si algún archivo está corrupto, huérfano o ha desaparecido del disco,
para confiar en que mi biblioteca es íntegra y no perder fotos silenciosamente.

---

## Descripción

El mayor miedo silencioso de cualquier fotógrafo que gestiona su propio archivo no es "no encontrar una foto" — es "perder una foto sin saberlo". Discos que fallan gradualmente, archivos que se corrompen durante transferencias, reorganizaciones manuales de carpetas que dejan registros huérfanos en la base de datos: todas estas situaciones pasan sin que ninguna herramienta lo notifique.

photoshelf tiene la posición única de ser la única herramienta que conoce tanto el estado de la base de datos como el estado real del disco. Esta US añade una herramienta de verificación periódica que detecta:

1. **Archivos huérfanos en DB**: registros en la base de datos que apuntan a rutas que ya no existen en disco
2. **Archivos no indexados en disco**: archivos de foto válidos en el directorio de fotos que no están en la DB
3. **Archivos corruptos**: archivos que existen pero no se pueden abrir (cabecera inválida, truncados)

El resultado es un informe de salud que el usuario puede revisar y sobre el cual puede tomar acciones: re-escanear los no indexados, marcar los huérfanos como "eliminados", o mover los corruptos a una carpeta de cuarentena.

---

## Criterios de aceptación

### Análisis de integridad
- [ ] Botón "Verificar integridad" en la sección de herramientas del sidebar
- [ ] El análisis corre en background con indicador de progreso (igual que el scan)
- [ ] Fase 1 — Huérfanos en DB: para cada foto en la DB, comprueba si `fs.existsSync(path)` devuelve true
- [ ] Fase 2 — No indexados: recorre los directorios de fotos y compara con la DB por ruta absoluta
- [ ] Fase 3 — Archivos corruptos: intenta abrir la cabecera JPEG/PNG con `sharp` para verificar que es una imagen válida
- [ ] La fase 3 es opcional y puede omitirse (es la más lenta); un checkbox "incluir verificación de cabecera" la activa
- [ ] El análisis respeta el patrón de estado en background de `scanState.ts` — no se puede relanzar si ya corre

### Informe de resultados
- [ ] Página `/tools/integrity` muestra el último informe con:
  - Total de fotos verificadas
  - Archivos huérfanos (en DB, sin fichero en disco): listado con ruta y evento
  - Archivos no indexados (en disco, sin registro en DB): listado con ruta
  - Archivos corruptos (si se activó la fase 3): listado con ruta y tipo de error
- [ ] Si no hay problemas: mensaje "Tu biblioteca está íntegra ✓"
- [ ] La fecha y hora del último análisis se muestran junto al botón

### Acciones sobre los resultados
- [ ] "Re-escanear no indexados": lanza un scan parcial solo de los archivos detectados como no indexados
- [ ] "Marcar huérfanos como eliminados": elimina los registros huérfanos de la DB (con confirmación + lista de afectados)
- [ ] "Mover corruptos a cuarentena": mueve los archivos corruptos a una carpeta `_quarantine/` (con confirmación)

### Notificación proactiva
- [ ] Si el watcher automático detecta que un archivo indexado desaparece del disco, añade una notificación visual en el sidebar (badge o indicador)

---

## API necesaria

### `POST /api/integrity/scan`
Lanza el análisis en background. Devuelve 409 si ya corre.

### `GET /api/integrity/status`
`{ running, progress, total_checked, orphans_found, unindexed_found, corrupt_found }`

### `GET /api/integrity/report`
Devuelve el último informe completo.

### `POST /api/integrity/resolve`
`{ action: "remove_orphans" | "quarantine_corrupt", ids: number[] }`

---

## Ruta y navegación

- Ruta: `/tools/integrity`
- Acceso: sidebar → sección "Herramientas" → "Integridad"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/tools/integrity/page.tsx` | Server component — carga último informe |
| `src/app/tools/integrity/IntegrityClient.tsx` | Client — progreso, resultados, acciones |
| `src/app/api/integrity/scan/route.ts` | Lanza análisis |
| `src/app/api/integrity/status/route.ts` | Estado del análisis |
| `src/app/api/integrity/report/route.ts` | Último informe |
| `src/app/api/integrity/resolve/route.ts` | Acciones sobre resultados |
| `src/lib/integrityScanner.ts` | Lógica de las tres fases de verificación |
| `src/lib/db.ts` | Tabla `integrity_reports` para persistir resultados |
| `src/components/Sidebar.tsx` | Badge de alerta si hay huérfanos |

---

## Notas técnicas

- Fase 1 y 2 son rápidas (solo `fs.existsSync`, sin leer contenido). En una biblioteca de 50k fotos debería completarse en < 30 segundos.
- Fase 3 (verificación de cabecera): `sharp(filePath).metadata()` que lanza si el archivo está corrupto. Puede ser lento en colecciones grandes — ejecutar en batches de 100 con `setImmediate` entre batches.
- Los resultados del informe se almacenan en una tabla `integrity_reports` con `type: "orphan" | "unindexed" | "corrupt"`, `path`, `photo_id?`, `detected_at`.
- El watcher de `folderWatcher.ts` ya detecta cambios en el sistema de archivos — conectarlo para emitir alertas cuando un archivo indexado desaparece.

---

## Fuera de alcance (v1)

- Verificación de checksums contra un registro histórico (requeriría guardar hash en la DB al indexar)
- Reparación automática de archivos corruptos
- Informe de salud en formato exportable (PDF/CSV)
- Programación automática de la verificación (cron semanal)
- Detección de disco con fallos inminentes (SMART data)
