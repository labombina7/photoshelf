# Componentes y estructura de la UI

## Árbol de rutas (App Router)

```
src/app/
├── layout.tsx                  ← Root layout: providers globales + fuente Geist
├── page.tsx                    ← Redirect → /library
├── login/page.tsx              ← Página de login (formulario de contraseña)
├── library/
│   ├── page.tsx                ← Server Component: carga fotos + sidebar data
│   ├── LibraryClient.tsx       ← Client Component: grid/lista, filtros, paginación
│   └── [photoId]/
│       ├── page.tsx            ← Server Component: foto + prev/next IDs
│       └── PhotoDetailClient.tsx ← Visor de foto (desktop + mobile fullscreen)
├── search/
│   ├── page.tsx                ← Server Component: ejecuta búsqueda, pasa resultado
│   └── SearchClient.tsx        ← Client Component: resultados, búsqueda profunda IA
├── map/
│   ├── page.tsx                ← Server Component: dynamic import (ssr: false)
│   ├── MapClient.tsx           ← Client Component: Leaflet + markercluster + filtro año
│   └── MapWrapper.tsx          ← Wrapper de carga dinámica
├── stats/
│   ├── page.tsx                ← Server Component
│   └── StatsClient.tsx         ← Client Component: cards + gráficas de barras CSS
├── projects/
│   ├── page.tsx                ← Lista de portfolios
│   ├── ProjectsClient.tsx      ← Client Component: CRUD de proyectos
│   └── [id]/page.tsx           ← Detalle de un portfolio
├── tags/
│   ├── page.tsx                ← Vista de tags
│   ├── TagsClient.tsx          ← Client Component: nube de tags + filtrado
│   └── [tag]/page.tsx          ← Galería de fotos por tag
├── settings/
│   └── catalogs/
│       ├── page.tsx            ← Server Component: lista de catálogos
│       └── CatalogsClient.tsx  ← Client Component: CRUD de catálogos
└── api/                        ← API Routes (ver doc de API)
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

## Layout de la aplicación

```
┌──────────────────────────────────────────────────────┐
│  AppHeader  [Logo] [SearchBar─────────────────] [✦]  │  ← header fijo, z-index alto
├─────────────┬────────────────────────────────────────┤
│             │                                        │
│   Sidebar   │           Contenido principal          │
│             │           (Server/Client Component)    │
│  - Nav      │                                        │
│  - Catálogos│                                        │
│  - Temáticas│                                        │
│  - Proyectos│                                        │
│  - Scan     │                                        │
│  - Watcher  │                                        │
└─────────────┴────────────────────────────────────────┘
```

En mobile (≤ 640 px) el sidebar se oculta y se accede desde un botón de menú en el header.

## Componentes compartidos

### `AppHeader.tsx`

Header fijo en la parte superior de todas las páginas. Contiene:

- **Logo / nombre** de la app (enlace a `/library`)
- **SearchBar** — input de búsqueda con clasificación de intención, historial, autocompletado y dropdown de sugerencias
- **SearchDropdown** — overlay con historial reciente, tags sugeridos y eventos que coinciden con el texto
- Botón IA (`✦`) — indicador visual cuando la búsqueda activa usa el clasificador de IA

El header escucha el evento `photoshelf:search-sync` para mantener el texto del input sincronizado cuando el usuario navega a la página `/search`.

### `SearchDropdown.tsx`

Dropdown del autocompletado de búsqueda. Aparece bajo el input mientras el usuario escribe y muestra:

- **Historial** reciente (máximo 5 entradas, guardado en localStorage)
- **Tags** del catálogo que coinciden con el texto
- **Eventos** del catálogo que coinciden con el texto

Al seleccionar un elemento ejecuta la búsqueda directamente o aplica el filtro correspondiente.

### `HeaderSlot.tsx` / `useHeaderSlot`

Sistema de portal liviano para inyectar contenido en el header desde páginas hijas. Algunas páginas (como `/search`) usan `useHeaderSlot` para renderizar controles contextuales en la zona derecha del header sin prop drilling.

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

Panel inferior deslizante para mobile. Reemplaza el panel lateral en pantallas pequeñas. Acepta `isOpen`, `onClose` y `children`. Incluye handle de drag y cierre con swipe hacia abajo.

### `Icons.tsx`

Biblioteca de iconos SVG inline. Exporta: `IconPhoto`, `IconGrid`, `IconStar`, `IconSearch`, `IconSparkle`, `IconRefresh`, `IconPlus`, `IconLogout`, `IconEdit`, `IconTrash`, `IconFolder`, `IconTag`, `IconTimeline`, `IconStats`, `IconMap`, `IconCatalog`, `IconSettings`, `IconMenu`.

### `DetailPanel.tsx`

Panel de información de una foto. En desktop se desliza desde la derecha; en mobile se integra en el bottom sheet del visor inmersivo.

Muestra: miniatura grande, metadatos EXIF (cámara, exposición, GPS, fecha), tags (manual + IA), temáticas asignadas, review de IA y acciones (favorita, añadir tag, asignar temática).

### `PhotoGrid.tsx`

Grid de fotos reutilizable (usado en Biblioteca y Proyectos). Acepta `photos[]`, `onSelect`, modo lista/grid.

### `FolderGrid.tsx`

Grid de grupos de eventos (vista de carpetas en Biblioteca). Muestra portada del evento, nombre y contador de fotos.

### `EmptyState.tsx`

Estado vacío genérico con icono, título, descripción y CTA opcional. Usado en Biblioteca, Tags y otras vistas cuando no hay datos.

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

### `LibraryClient.tsx`

```
Estado local:
  view: 'grid' | 'list' | 'folders'
  page: number
  filters: { year, event, theme, favorite, untagged, tag, search }

Flujo:
  URL params → filtros activos → fetch /api/photos → PhotoGrid / FolderGrid
  Click foto → navega a /library/[id]
  Click carpeta → aplica filtro event=
```

### `PhotoDetailClient.tsx`

Visor de foto con dos modos de experiencia según breakpoint:

**Desktop (≥ 641 px)**
```
  [← Atrás]  [N de M]          [★]  [⛶ Fullscreen]
  ┌────────────────────┬───────────────────────────┐
  │                    │  DetailPanel              │
  │    Foto (contain)  │  - Metadatos EXIF         │
  │                    │  - Tags                   │
  │  [‹ Anterior]      │  - Temáticas              │
  │         [Siguiente ›]  - Review IA             │
  └────────────────────┴───────────────────────────┘
```

**Mobile (≤ 640 px) — visor inmersivo**
```
  ┌─────────────────────────────┐  ← negro, 100dvh
  │ ← Atrás             ⓘ Info │  ← HUD semitransparente
  │                             │
  │         [ FOTO ]            │
  │                             │
  │     ‹               ›       │  ← flechas nav
  └─────────────────────────────┘
  [pulsar ⓘ abre el BottomSheet con DetailPanel]
```

Estado del componente:
- `hudVisible` — visibilidad del HUD (toggle con tap en la imagen)
- `mobileSheetOpen` — apertura del bottom sheet de información

### `SearchClient.tsx`

```
Props: result: SearchResult (fotos, tags, eventos que coinciden)

Secciones:
  - SearchPhotoGrid: grid de fotos con enlace al detalle
  - TagsSection: tags coincidentes
  - EventsSection: eventos coincidentes
  - DeepSearchPanel: búsqueda profunda con IA (streaming de resultados)
  - SaveThemePanel: guardar resultados como temática

Sincroniza el texto del header con el parámetro ?q= via evento
photoshelf:search-sync
```

### `MapClient.tsx`

```
Carga dinámica (ssr: false) para evitar errores de window en SSR.
Leaflet inicializado en useEffect.
markerClusterGroup con L.divIcon circular (miniatura de foto).
Filtro por año en la topbar — reduce marcadores de 10k+ a ~500.
Click en marker → navega a /library/[id].
```

### `StatsClient.tsx`

```
Datos cargados por el Server Component padre.
Visualización:
  - Cards: total fotos, eventos, años activos, favoritas
  - Barra CSS: fotos por año, por mes, por hora, por cámara
  - Top tags: lista con conteo
```

### `CatalogsClient.tsx`

```
Gestión de catálogos:
  - Listado con nombre, ruta, conteo de fotos y badge de "activo"
  - Crear catálogo: nombre + ruta del directorio
  - Editar nombre o ruta
  - Eliminar (con confirmación)
  - Cambiar catálogo por defecto
```
