# Componentes y estructura de la UI

## Árbol de rutas (App Router)

```
src/app/
├── layout.tsx              ← Root layout: providers globales + fuente Geist
├── page.tsx                ← Redirect → /library
├── login/page.tsx          ← Página de login (formulario de contraseña)
├── library/
│   ├── page.tsx            ← Server Component: carga fotos + sidebar data
│   ├── LibraryClient.tsx   ← Client Component: grid/lista, filtros, paginación
│   └── [photoId]/page.tsx  ← Detalle de foto (modal accesible por URL directa)
├── map/
│   ├── page.tsx            ← Server Component: dynamic import (ssr: false)
│   ├── MapClient.tsx       ← Client Component: Leaflet + markercluster + filtro año
│   └── MapWrapper.tsx      ← Wrapper de carga dinámica
├── stats/
│   ├── page.tsx            ← Server Component
│   └── StatsClient.tsx     ← Client Component: cards + gráficas de barras CSS
├── projects/
│   ├── page.tsx            ← Lista de portfolios
│   ├── ProjectsClient.tsx  ← Client Component: CRUD de proyectos
│   └── [id]/page.tsx       ← Detalle de un portfolio
├── tags/
│   ├── page.tsx            ← Vista de tags
│   ├── TagsClient.tsx      ← Client Component: nube de tags + filtrado
│   └── [tag]/page.tsx      ← Galería de fotos por tag
├── settings/
│   └── catalogs/
│       ├── page.tsx        ← Server Component: lista de catálogos
│       └── CatalogsClient.tsx ← Client Component: CRUD de catálogos
└── api/                    ← API Routes (ver doc de API)
```

## Proveedores de contexto (Root Layout)

El `RootLayout` envuelve la app en tres proveedores:

```
ModalProvider
  └── ScanProvider
        └── ClassifyProvider
              └── {children}
```

| Proveedor | Propósito |
|---|---|
| `ModalProvider` | Gestiona modales de confirmación y alertas globales (`confirm`, `alert`) |
| `ScanProvider` | Expone `running`, `startScan`, `watcher`, `toggleWatcher`; hace polling a `/api/scan/status` y `/api/watcher/status` |
| `ClassifyProvider` | Expone estado de clasificación IA; hace polling a `/api/ai/classify/status` |

## Componentes compartidos

### `Sidebar.tsx`

Barra lateral de navegación principal. Contiene:

- `CatalogSwitcher` — selector del catálogo activo en la cabecera del sidebar
- Links a todas las vistas (Biblioteca, Línea de tiempo, Mapa, Estadísticas, Favoritos, Tags, Portfolio)
- CRUD de **Temáticas** (crear, editar, eliminar, cambiar color)
- Lista de **Proyectos** guardados
- Botón de escaneo manual con toast de progreso
- Indicador del vigilante de carpetas (punto pulsante azul/gris)
- Enlace a **Ajustes > Catálogos**
- Botón de logout

### `CatalogSwitcher.tsx`

Selector de catálogo activo integrado en el sidebar. Solo se muestra cuando hay más de un catálogo (si hay uno, se muestra como badge de nombre). Al pulsar sobre el nombre se despliega el listado de catálogos disponibles para cambiar el activo. El cambio llama a `POST /api/catalogs/switch` y recarga la página.

### `BottomSheet.tsx`

Panel inferior deslizante para mobile (US-013). Reemplaza el panel lateral en pantallas pequeñas. Acepta `isOpen`, `onClose` y `children`. Incluye handle de drag y cierre con swipe hacia abajo.

### `Icons.tsx`

Biblioteca de iconos SVG inline (US-026). Exporta: `IconPhoto`, `IconGrid`, `IconStar`, `IconSearch`, `IconRefresh`, `IconPlus`, `IconLogout`, `IconEdit`, `IconTrash`, `IconFolder`, `IconTag`, `IconTimeline`, `IconStats`, `IconMap`, `IconCatalog`, `IconSettings`.

### `DetailPanel.tsx`

Panel lateral deslizante (desktop) / bottom sheet (mobile) que muestra el detalle de una foto: miniatura grande, metadatos EXIF (cámara, exposición, GPS, fecha), tags (manual + IA), temáticas asignadas, y acciones (favorita, añadir tag, asignar temática).

### `PhotoGrid.tsx`

Grid de fotos reutilizable (usado en Biblioteca y Proyectos). Acepta `photos[]`, `onSelect`, modo lista/grid.

### `FolderGrid.tsx`

Grid de grupos de eventos (vista de carpetas en Biblioteca). Muestra portada del evento, nombre y contador de fotos.

### `AISearchPanel.tsx`

Panel de búsqueda con IA. Toggle entre modo rápido (tags) y modo profundo (visión). Muestra resultados inline con indicador de carga.

### `EmptyState.tsx`

Estado vacío genérico con icono, título, descripción y CTA opcional. Usado en Biblioteca, Tags y otras vistas cuando no hay datos (US-012).

### `ModalProvider.tsx`

Context que expone dos funciones:
- `confirm(message)` → `Promise<boolean>` — diálogo de confirmación con "Sí / Cancelar"
- `alert(message)` → `Promise<void>` — diálogo de información

Renderiza un modal flotante centralizado; evita el uso de `window.confirm`.

### `ScanProvider.tsx`

Context con polling:
- Cada 2 segundos cuando `running === true`
- Expone: `running`, `done`, `total`, `currentEvent`, `startScan()`, `watcher`, `toggleWatcher()`
- El toast de progreso de escaneo vive aquí

### `ClassifyProvider.tsx`

Context con polling al estado de clasificación IA:
- Cada 2 segundos cuando hay una clasificación en curso
- Expone: `classifying`, `classifyDone`, `classifyTotal`

## Páginas clave — detalles

### LibraryClient.tsx

```
Estado local:
  view: 'grid' | 'list' | 'folders'
  page: number
  filters: { year, event, theme, favorite, untagged, tag, search }

Flujo:
  URL params → filtros activos → fetch /api/photos → PhotoGrid / FolderGrid
  Click foto → DetailPanel (desliza desde la derecha en desktop, BottomSheet en mobile)
  Click carpeta → aplica filtro event=
```

### MapClient.tsx

```
Carga dinámica (ssr: false) para evitar errores de window en SSR.
Leaflet inicializado en useEffect.
markerClusterGroup con L.divIcon circular (foto de miniatura).
Filtro por año en la topbar — reduce marcadores de 10k+ a ~500 (US-027).
Click en marker → panel lateral (desktop) / BottomSheet (mobile) con info de foto.
```

### StatsClient.tsx

```
Datos cargados por el Server Component padre.
Visualización:
  - Cards: total fotos, eventos, años activos, favoritas
  - Barra CSS: fotos por año, por mes, por hora, por cámara
  - Top tags: lista con conteo
```

### CatalogsClient.tsx

```
Gestión de catálogos (EPIC-001):
  - Listado con nombre, ruta, conteo de fotos y badge de "activo"
  - Crear catálogo: nombre + ruta del directorio
  - Editar nombre o ruta
  - Eliminar (con confirmación)
  - Cambiar catálogo por defecto
```
