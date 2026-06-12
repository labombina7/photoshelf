# Feature: Watcher compatible con múltiples catálogos

## Historia de usuario

Como usuario con varios catálogos configurados,
quiero que la vigilancia automática de carpetas escanee la ruta correcta de cada catálogo y clasifique solo sus fotos,
para que el auto-escaneo no indexe fotos con rutas erróneas ni intente clasificar fotos de catálogos ajenos.

---

## Descripción

El tech debt audit del 2026-06-12 detectó que `folderWatcher.ts` quedó anclado al modelo pre-EPIC-001 (catálogo único):

1. **`runAutoScan` escanea siempre `PHOTOS_PATH` (env) hacia `catalogId=1`** (`folderWatcher.ts:68`). Si el usuario cambió la ruta del catálogo 1 vía UI (EPIC-001 lo permite), el watcher sigue vigilando la ruta vieja del env y los paths relativos que inserta no casan con la ruta real del catálogo → thumbnails rotos.
2. **`runAutoClassify` selecciona fotos sin tags de TODOS los catálogos** (`folderWatcher.ts:91-98`, sin filtro `catalog_id`) pero resuelve sus paths contra `PHOTOS_PATH` — las fotos de otros catálogos fallan la clasificación en silencio (catch vacío, línea 115) **en cada ciclo**, desperdiciando intentos del límite de 200.

El worker de jobs ya hace lo correcto (`worker.ts:126` resuelve el path desde BD) — el watcher debe seguir el mismo patrón.

---

## Criterios de aceptación

### Escaneo con ruta de BD
- [ ] `runAutoScan` resuelve la ruta con `getCatalogById(1)?.path ?? PHOTOS_PATH` (mismo patrón que worker.ts)
- [ ] El watcher vigila la ruta del catálogo según BD, y se re-engancha si esa ruta cambia (al menos: log claro indicando que requiere reinicio)

### Clasificación acotada
- [ ] La query de `runAutoClassify` filtra `WHERE p.catalog_id = ?` con el catálogo vigilado
- [ ] Las fotos de otros catálogos no consumen el límite de 200 por ciclo
- [ ] Los errores de clasificación dejan de ser silenciosos: contador + log resumen al final del ciclo

### Tests
- [ ] Test que verifica que el auto-classify no selecciona fotos de un catálogo distinto al vigilado

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/folderWatcher.ts` | Ruta desde BD + filtro catalog_id + logging de errores |
| `src/lib/__tests__/folderWatcher.test.ts` | Casos multi-catálogo |

---

## Notas técnicas

- Vigilar N catálogos a la vez (un `fs.watch` por catálogo) es la solución completa, pero dispara la complejidad — para v1 basta con que el catálogo 1 funcione correctamente con su ruta de BD y que la clasificación no cruce catálogos.
- `getCatalogById` ya existe en `src/lib/queries/catalogs.ts`.

---

## Fuera de alcance (v1)

- Vigilancia simultánea de todos los catálogos
- UI para elegir qué catálogo vigila el watcher

> Estado: ✅ Desplegada
