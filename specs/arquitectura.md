# Arquitectura de photoshelf

**Última actualización:** 2026-05-24

photoshelf es una aplicación Next.js 15 (App Router, React 19) que sirve como biblioteca
personal de fotos con análisis de IA local (Ollama). Corre en un NAS o servidor doméstico.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Base de datos | SQLite via `better-sqlite3` |
| IA local | Ollama (llava) |
| Autenticación | Session cookie con `iron-session` |
| Thumbnails | `sharp` + HEIC support via `heic-convert` |
| Tests | Jest + ts-jest |
| CI/CD | GitHub Actions → Docker Hub |

---

## Estructura de directorios

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # Route handlers (HTTP boundary)
│   │   ├── catalogs/           # CRUD catálogos + switch activo (EPIC-001)
│   │   ├── photos/             # listado, detalle, thumbnail, original
│   │   ├── ai/                 # classify, search, review, batch
│   │   ├── scan/               # escaneo de directorio
│   │   ├── tags/, themes/, projects/, timeline/, stats/
│   │   ├── auth/               # login / logout
│   │   └── watcher/            # file watcher toggle
│   ├── library/                # Timeline + detalle de foto
│   ├── map/                    # Mapa interactivo (Leaflet)
│   ├── tags/, stats/, projects/, settings/catalogs/
│   └── login/
│
├── components/                 # Componentes React reutilizables
│   ├── Sidebar.tsx             # Navegación lateral + CatalogSwitcher
│   ├── CatalogSwitcher.tsx     # Selector de catálogo activo (EPIC-001)
│   ├── BottomSheet.tsx         # Panel móvil (US-013)
│   ├── Icons.tsx               # Biblioteca de iconos SVG (US-026)
│   ├── PhotoGrid.tsx, FolderGrid.tsx
│   ├── AISearchPanel.tsx, DetailPanel.tsx
│   ├── EmptyState.tsx          # Estados vacíos con CTA (US-012)
│   ├── ClassifyProvider.tsx, ScanProvider.tsx, ModalProvider.tsx
│   └── ...
│
├── lib/                        # Lógica de servidor
│   ├── queries/                # Capa de repositorio (US-022)
│   │   ├── index.ts            # Re-exports
│   │   ├── photos.ts           # photoQueries.*
│   │   ├── catalogs.ts         # catalogQueries.* (EPIC-001)
│   │   ├── catalog.ts          # getActiveCatalog, switchCatalog
│   │   ├── timeline.ts         # timelineQueries.*
│   │   ├── tags.ts             # tagQueries.*
│   │   ├── themes.ts           # themeQueries.*
│   │   ├── stats.ts            # statsQueries.*
│   │   ├── groups.ts           # groupQueries.*
│   │   └── sidebar.ts          # sidebarQueries.*
│   ├── db.ts                   # getDb() — conexión SQLite singleton
│   ├── db-helpers.ts           # upsertAiTags, buildPhotoFilter, PHOTOS_PATH (US-016)
│   ├── catalog-context.ts      # Contexto de catálogo activo por request (EPIC-001)
│   ├── config.ts               # Configuración de la aplicación
│   ├── scanner.ts              # Escaneo de directorio de fotos
│   ├── thumbnail.ts            # Generación de thumbnails (sharp)
│   ├── ollama.ts               # Cliente Ollama para clasificación IA
│   ├── session.ts              # iron-session helpers
│   ├── scanState.ts            # Estado global de escaneo
│   ├── classifyState.ts        # Estado global de clasificación IA
│   ├── folderWatcher.ts        # Watcher de cambios en el directorio
│   ├── watcherState.ts         # Estado del watcher
│   └── types.ts                # Tipos TypeScript compartidos
│
├── __tests__/                  # Tests de integración
│   ├── ollama.test.ts
│   ├── projectFilters.test.ts
│   └── session.test.ts
│
└── instrumentation.ts          # Next.js instrumentation (init del watcher)
```

---

## Capas de acceso a datos

La arquitectura sigue un flujo unidireccional tras la refactorización (US-016 + US-022):

```
Server Components / Route Handlers
        ↓
  src/lib/queries/       ← única capa que escribe SQL
        ↓
  src/lib/db-helpers.ts  ← helpers de mutación reutilizables (upsertAiTags, etc.)
        ↓
  src/lib/db.ts          ← getDb() singleton SQLite
```

**Regla:** ni los Server Components ni los route handlers importan `getDb()` ni escriben SQL inline.
Todo acceso a datos pasa por `queries/`.

---

## Modelo de datos (SQLite)

Tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `photos` | Foto individual: path, fecha, GPS, thumbnailPath, catalogId |
| `catalogs` | Biblioteca de fotos: id, name, path, isDefault (EPIC-001) |
| `ai_tags` | Tags generados por IA: photoId, tag, confidence |
| `photo_themes` | Temas asignados por IA |
| `projects` | Proyectos fotográficos agrupados |
| `project_photos` | Relación proyecto ↔ foto |

**Catálogo activo:** se resuelve por request en `src/lib/catalog-context.ts`. La cookie
`active_catalog_id` determina qué subconjunto de datos ve el usuario. Todas las queries
de `src/lib/queries/` reciben el `catalogId` como parámetro.

---

## Múltiples catálogos (EPIC-001)

Antes: una sola ruta configurada con `PHOTOS_PATH` (variable de entorno).

Ahora:
- La tabla `catalogs` almacena N bibliotecas (nombre + ruta).
- `photos.catalog_id` FK → `catalogs.id`.
- El componente `CatalogSwitcher` en el sidebar cambia el catálogo activo sin recargar.
- Las rutas API `/api/catalogs/` gestionan CRUD y switch.
- `catalog-context.ts` resuelve el catálogo activo por request desde la cookie de sesión.
- El escaneo, las queries de filtrado y las rutas de API filtran siempre por `catalog_id`.

---

## Tests

Cobertura añadida en US-019:

| Fichero de test | Qué cubre |
|----------------|----------|
| `src/lib/__tests__/config.test.ts` | Lectura y validación de config |
| `src/lib/__tests__/scanner.test.ts` | Lógica de escaneo de archivos |
| `src/lib/__tests__/thumbnail.test.ts` | Generación de thumbnails |
| `src/app/api/auth/__tests__/login.test.ts` | Flujo de autenticación |
| `src/__tests__/session.test.ts` | Manejo de sesión |
| `src/__tests__/ollama.test.ts` | Cliente Ollama |
| `src/__tests__/projectFilters.test.ts` | Filtros de proyectos |

---

## Flujo de escaneo

```
Usuario activa scan → POST /api/scan
        ↓
  scanner.ts escanea el directorio del catálogo activo
        ↓
  Upsert de fotos en BD (upsertPhoto en db-helpers.ts)
        ↓
  Generación de thumbnails (thumbnail.ts → sharp)
        ↓
  Estado accesible via GET /api/scan/status
```

---

## Pendiente de implementar

| Área | US | Descripción |
|------|-----|-------------|
| API estándar | US-023 | Envelope `{ data, error, meta }`, prefijo `/api/v1/` |
| iOS browsing | US-024 | Timeline + detalle optimizados para app nativa |
| iOS acciones | US-025 | Búsqueda, tags, scan, auth para app nativa |
| Hardening | US-017 | Try/catch sistemático, tipos unificados |
| LLM cloud | US-021 | OpenAI/Anthropic como alternativa a Ollama |
