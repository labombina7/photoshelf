# Componentes y estructura de la UI

## Árbol de rutas (App Router)

```
src/app/
├── layout.tsx              ← Root layout: providers globales + fuente Inter
├── page.tsx                ← Redirect → /library
├── login/page.tsx          ← Página de login (formulario de contraseña)
├── library/
│   ├── page.tsx            ← Server Component: carga fotos + sidebar data
│   ├── LibraryClient.tsx   ← Client Component: grid/lista, filtros, paginación
│   └── [photoId]/page.tsx  ← Detalle de foto (modal accesible por URL directa)
├── timeline/
│   ├── page.tsx            ← Server Component: layout + datos iniciales
│   └── TimelineClient.tsx  ← Client Component: scroll infinito, zoom, grupos
├── map/
│   ├── page.tsx            ← Server Component: dynamic import (ssr: false)
│   └── MapClient.tsx       ← Client Component: Leaflet + markercluster
├── stats/
│   ├── page.tsx            ← Server Component
│   └── StatsClient.tsx     ← Client Component: cards + gráficas de barras CSS
├── projects/
│   ├── page.tsx            ← Lista de portfolios
│   ├── ProjectsClient.tsx  ← Client Component: CRUD de proyectos
│   └── [id]/page.tsx       ← Detalle de un portfolio
├── tags/
│   ├── page.tsx            ← Vista de tags
│   └── TagsClient.tsx      ← Client Component: nube de tags + filtrado
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

- Links a todas las vistas (Biblioteca, Línea de tiempo, Mapa, Estadísticas, Favoritos, Tags, Portfolio)
- CRUD de **Temáticas** (crear, editar, eliminar, cambiar color)
- Lista de **Proyectos** guardados
- Botón de escaneo manual con toast de progreso
- Indicador del vigilante de carpetas (punto pulsante azul/gris)
- Botón de logout

Se implementa en dos partes para cumplir la regla de Suspense de Next.js:

```tsx
function SidebarInner(props: SidebarProps) {
  const searchParams = useSearchParams(); // requiere Suspense
  // ...toda la lógica
}

export default function Sidebar(props: SidebarProps) {
  return <Suspense><SidebarInner {...props} /></Suspense>;
}
```

### `Icons.tsx`

Biblioteca de iconos SVG inline. Exporta: `IconPhoto`, `IconGrid`, `IconStar`, `IconSearch`, `IconRefresh`, `IconPlus`, `IconLogout`, `IconEdit`, `IconTrash`, `IconFolder`, `IconTag`, `IconTimeline`, `IconStats`, `IconMap`.

### `DetailPanel.tsx`

Panel lateral deslizante que muestra el detalle de una foto: miniatura grande, metadatos EXIF (cámara, exposición, GPS, fecha), tags (manual + IA), temáticas asignadas, y acciones (favorita, añadir tag, asignar temática).

### `PhotoGrid.tsx`

Grid de fotos reutilizable (usado en Biblioteca y Proyectos). Acepta `photos[]`, `onSelect`, modo lista/grid.

### `FolderGrid.tsx`

Grid de grupos de eventos (vista de carpetas en Biblioteca). Muestra portada del evento, nombre y contador de fotos.

### `AISearchPanel.tsx`

Panel de búsqueda con IA. Toggle entre modo rápido (tags) y modo profundo (visión). Muestra resultados inline con indicador de carga.

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
  Click foto → DetailPanel (desliza desde la derecha)
  Click carpeta → aplica filtro event=
```

### TimelineClient.tsx

```
Estado:
  level: 'year' | 'month' | 'day'   ← persiste en localStorage
  groups: TimelineGroup[]            ← cargados por cursor
  cursor: string | null

Derivados:
  visualZoom = LEVEL_ZOOM[level]     ← { year:1, month:3, day:4 }
  vzConfig = VISUAL_ZOOM_CONFIG[visualZoom - 1]

IntersectionObserver → sentinel al final → carga siguiente página
Prefetch: rootMargin 800px + <link rel="prefetch"> proactivo
Skeleton: .photo-skeleton visible hasta onLoad del <img>
```

### MapClient.tsx

```
Carga dinámica (ssr: false) para evitar errores de window en SSR.
Leaflet inicializado en useEffect.
markerClusterGroup con L.divIcon circular (foto de miniatura).
Click en marker → panel lateral con info de foto y link a detalle.
```

### StatsClient.tsx

```
Datos cargados por el Server Component padre.
Visualización:
  - Cards: total fotos, eventos, años activos, favoritas
  - Barra CSS: fotos por año, por mes, por hora, por cámara
  - Top tags: lista con conteo
```
