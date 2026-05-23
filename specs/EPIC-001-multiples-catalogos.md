# Épica: Múltiples catálogos de fotos

> **Estado: 🗂 Planificada** — descomposición de US-009

---

## Visión general

Hoy photoshelf gestiona una única fuente de fotos fijada en la variable de entorno `PHOTOS_PATH`.
El objetivo de esta épica es permitir conectar **cualquier número de directorios** como catálogos
independientes y ofrecerle al usuario una vista unificada o filtrada por catálogo desde el timeline
y el sidebar.

El sistema es **agnóstico respecto a la estructura de carpetas**: no le pide al usuario que
especifique cómo están organizadas sus fotos. En el primer escaneo, detecta automáticamente si
un catálogo sigue la convención `año/evento` (modo `structured`) o tiene cualquier otra organización
(modo `flat`), y se comporta en consecuencia. El usuario nunca ve ni toca esta distinción.

El caso de uso concreto que motiva esta épica:

> *"Tengo mi biblioteca principal en `año/evento/imgs` y la del móvil en el NAS con una estructura
> plana. Quiero ver ambas en photoshelf sin reorganizar carpetas ni configurar nada especial."*

---

## Problema técnico actual

| Restricción | Dónde está en el código |
|---|---|
| Un único `PHOTOS_PATH` global | `PHOTOS_PATH` hardcodeado en `scan/route.ts`, `folderWatcher.ts`, `thumbnail/route.ts` |
| Escáner asume estructura `año/evento/file` | `walkPhotosPerYear` en `scanner.ts` — ignora directorios no numéricos |
| `photos.path` relativo a un único root | JOIN implícito con root único; sin columna `catalog_id` |
| Clave de caché sin catalog | `md5(path:size:fit)` en `thumbnail.ts` — colisiones si dos catálogos tienen paths relativos iguales |
| Sidebar hardcodeado a `/photos` | `sidebar-user-sub` muestra la cadena literal `/photos` |

---

## Riesgos técnicos

1. **Migración de la columna `catalog_id`** — SQLite no soporta `ALTER TABLE ADD COLUMN … NOT NULL` sin
   default. Se resuelve añadiendo la columna como `nullable` primero y migrando datos después.

2. **Collisión de rutas relativas en caché** — dos catálogos pueden tener un fichero `2024/viaje/IMG_001.jpg`
   cada uno. La clave de caché actual no los distingue. Se añade `catalogId` a la clave MD5.

3. **Detección automática de estructura con umbral** — la heurística del 70 % cubre el caso habitual
   (biblioteca de años con alguna carpeta extra en el root), pero puede clasificar incorrectamente un
   catálogo atípico. El modo detectado se persiste en la primera pasada y no se re-evalúa
   automáticamente si la estructura cambia con el tiempo. Un override manual queda fuera de alcance de v1.

4. **Escáner en modo flat con muchos archivos** — sin estructura de eventos, un directorio con 50 000 fotos
   se recorre recursivamente. Hay que procesar en lotes de 50 y derivar `year`/`event` del EXIF para
   evitar picos de memoria y mantener información temporal útil.

5. **Watcher limitado al catálogo principal** — `folderWatcher.ts` sólo vigila `PHOTOS_PATH`. Los catálogos
   secundarios no tendrán detección automática de cambios en v1.

6. **Rutas absolutas en `catalog.root_path`** — si el contenedor se reconfigura y cambia el mount point,
   las rutas almacenadas en la DB quedan rotas. Documentar como limitación de v1.

---

## Estrategia de coexistencia (zero breakage)

El principio rector de toda la épica es **additive-only hasta el último momento**:

- La columna `catalog_id` se añade como `INTEGER DEFAULT 1` para que todo el código existente
  siga funcionando sin cambios.
- El catálogo `id = 1` se crea en la migración con los valores del `PHOTOS_PATH` actual.
- Cada endpoint y componente sigue funcionando con el comportamiento actual hasta que se active
  explícitamente la nueva funcionalidad.
- Las historias se pueden desplegar en orden y cada una deja el sistema en un estado funcional.

---

## Historias hijas

| ID | Título | Dependencias | Estado |
|---|---|---|---|
| [US-009a](US-009a-migracion-catalogs-bd.md) | Migración additive de BD — tabla `catalogs` y `catalog_id` | — | ⬜ Pendiente |
| [US-009b](US-009b-api-crud-catalogos.md) | API REST CRUD de catálogos | US-009a | ⬜ Pendiente |
| [US-009c](US-009c-scanner-modo-flat.md) | Escáner con detección automática de estructura | US-009a | ⬜ Pendiente |
| [US-009d](US-009d-thumbnails-multiples-catalogos.md) | Resolución dinámica de `photosRoot` en thumbnails | US-009a | ⬜ Pendiente |
| [US-009e](US-009e-timeline-selector-catalogo.md) | Selector de catálogo en el timeline | US-009a + US-009b | ⬜ Pendiente |
| [US-009f](US-009f-sidebar-arbol-catalogos.md) | Sidebar con árbol de navegación por catálogo | US-009a + US-009b | ⬜ Pendiente |
| [US-009g](US-009g-gestion-catalogos-ui.md) | Gestión de catálogos desde la UI | US-009b + US-009f | ⬜ Pendiente |

---

## Orden de ejecución recomendado

```
US-009a  ──┬──► US-009b ──┬──► US-009e
           │               └──► US-009f ──► US-009g
           ├──► US-009c
           └──► US-009d
```

**Fase 1 — Fundamentos (sin impacto en UI)**
: `US-009a` → `US-009b` → `US-009c` + `US-009d` (en paralelo)

**Fase 2 — UI incremental**
: `US-009e` + `US-009f` (en paralelo, ambas sobre una única instancia con catálogo por defecto)

**Fase 3 — Gestión completa**
: `US-009g` (modal de alta/baja de catálogos; cierra la épica)

---

## Fuera de alcance de la épica

- Watcher automático para catálogos secundarios
- Sincronización remota (SMB, SFTP, cloud)
- Deduplicación entre catálogos
- Permisos por catálogo
- Importar / mover fotos entre catálogos
