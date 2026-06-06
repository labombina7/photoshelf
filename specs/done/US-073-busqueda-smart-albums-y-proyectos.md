# US-073 — Búsqueda extendida: carpetas inteligentes y proyectos del portfolio

> Estado: ✅ Desplegada

## Resumen

El buscador actual clasifica y devuelve resultados basándose únicamente en **eventos**, **temáticas** y **tags**. Las **carpetas inteligentes** (smart albums) y los **proyectos del portfolio** son entidades de primera clase en Photoshelf pero están completamente excluidas del motor de búsqueda: ni aparecen como sugerencias, ni el clasificador las reconoce, ni se devuelven como resultados directos.

Esta historia extiende la capa de búsqueda (`src/lib/search/`) para que ambas entidades sean ciudadanos de pleno derecho en las búsquedas.

---

## Problema

Un usuario que busca "Galería azul" (nombre de una carpeta inteligente) o "Proyecto boda" (título de un proyecto del portfolio) obtiene resultados de fotos sueltas que coinciden por nombre de archivo, en el mejor caso. La entidad como tal — la carpeta o el proyecto — nunca aparece. El usuario no puede navegar a ella desde la búsqueda.

Adicionalmente, las sugerencias del campo de búsqueda solo proponen tags y eventos, ignorando las otras dos entidades.

---

## Comportamiento esperado

### Sugerencias en el buscador (autocompletado)

Mientras el usuario teclea, el dropdown de sugerencias incluye:

| Categoría | Icono | Ejemplo |
|---|---|---|
| Tags | 🏷️ | "retrato (34 fotos)" |
| Eventos | 📅 | "Boda Ana · 2022 (120 fotos)" |
| Carpetas inteligentes | 📂 | "Galería azul (48 fotos)" |
| Proyectos | 🗂️ | "Proyecto boda" |

### Resultados de búsqueda

- Si la consulta coincide con el nombre de una carpeta inteligente, se muestra la sección **"Carpetas inteligentes"** en los resultados con las fotos que contiene (hasta el límite habitual de 200).
- Si la consulta coincide con el título de un proyecto, se muestra la sección **"Proyectos"** con las fotos asignadas.
- Ambas secciones coexisten con las secciones existentes (tags, eventos, fotos directas).
- Hacer clic en una carpeta o proyecto en los resultados navega directamente a la vista de esa entidad (no a la búsqueda filtrada).

### Clasificador de intención

El clasificador (`classifier.ts`) reconoce consultas que coincidan exactamente con el nombre de un smart album o el título de un proyecto y asigna el intent `smart_album` o `project` respectivamente. Si no hay coincidencia exacta, el intent no cambia.

---

## Criterios de aceptación

- [ ] Las sugerencias del buscador incluyen smart albums que coincidan con el texto tecleado (máx. 3)
- [ ] Las sugerencias incluyen proyectos que coincidan con el texto tecleado (máx. 3)
- [ ] Seleccionar una sugerencia de smart album navega a `/smart-albums/[id]`
- [ ] Seleccionar una sugerencia de proyecto navega a `/portfolio/[id]`
- [ ] Una búsqueda cuyo texto coincide exactamente con un nombre de smart album devuelve la sección "Carpetas inteligentes" con sus fotos
- [ ] Una búsqueda cuyo texto coincide exactamente con un título de proyecto devuelve la sección "Proyectos" con sus fotos
- [ ] Las búsquedas que no coinciden con ninguna entidad funcionan exactamente igual que antes
- [ ] `getSearchHints` incluye smart albums y proyectos para el clasificador
- [ ] El cache de hints (`HINTS_TTL_MS`) se aplica también a las nuevas entidades

---

## Diseño técnico

### `src/lib/search/classifier.ts`

Extender `ClassifierHints` con las nuevas entidades:

```typescript
export interface ClassifierHints {
  tags: string[];
  events: string[];
  smartAlbums: { id: number; name: string }[];   // nuevo
  projects: { id: number; title: string }[];       // nuevo
}
```

Añadir dos nuevos intents al clasificador:

```typescript
| { type: 'smart_album'; id: number; name: string }
| { type: 'project'; id: number; title: string }
```

La lógica de clasificación comprueba coincidencia exacta (case-insensitive) contra `smartAlbums` y `projects` antes de caer en `fulltext`.

### `src/lib/search/execute.ts`

Ampliar `loadHints()` para cargar smart albums y proyectos con sus IDs. Añadir dos estrategias nuevas:

```typescript
function searchBySmartAlbum(id: number, catalogId: number): SearchPhotoRow[]
// Reutiliza getSmartAlbumPhotos() de src/lib/queries/smartAlbums.ts

function searchByProject(id: number): SearchPhotoRow[]
// Reutiliza getProjectPhotos() de src/lib/queries/projects.ts
```

Ampliar `SearchResult` con campos opcionales:

```typescript
export interface SearchResult {
  // ... campos existentes ...
  smartAlbums: SmartAlbumMatch[];   // nuevo
  projects: ProjectMatch[];          // nuevo
}

export interface SmartAlbumMatch {
  id: number;
  name: string;
  photo_count: number;
}

export interface ProjectMatch {
  id: number;
  title: string;
  photo_count: number;
}
```

### `src/lib/queries/search.ts`

Ampliar `getSearchSuggestions()` para incluir smart albums y proyectos:

```typescript
export interface SmartAlbumSuggestion {
  id: number;
  name: string;
  count: number;
}

export interface ProjectSuggestion {
  id: number;
  title: string;
}

export interface SearchSuggestions {
  tags: TagSuggestion[];
  events: EventSuggestion[];
  smartAlbums: SmartAlbumSuggestion[];   // nuevo
  projects: ProjectSuggestion[];           // nuevo
}
```

Query para smart albums (la `photo_count` ya la calcula `listSmartAlbums`, pero para sugerencias es aceptable una aproximación):

```sql
SELECT id, name
FROM smart_albums
WHERE name LIKE ? ESCAPE '\'
  AND (catalog_id IS NULL OR catalog_id = ?)
ORDER BY name ASC LIMIT 3
```

Query para proyectos:

```sql
SELECT id, title
FROM portfolio_projects
WHERE title LIKE ? ESCAPE '\'
ORDER BY title ASC LIMIT 3
```

### `src/app/api/search/suggestions/route.ts`

Incluir `smartAlbums` y `projects` en la respuesta JSON existente (o el endpoint que alimenta el autocompletado).

### UI: componente de sugerencias

El dropdown de sugerencias renderiza dos secciones nuevas, diferenciadas visualmente (icono + label de categoría). El ítem incluye nombre y, si está disponible, recuento de fotos. El `href` apunta a la vista propia de la entidad, no a `/search`.

### UI: página de resultados (`src/app/search/SearchClient.tsx`)

Si `result.smartAlbums.length > 0`, renderizar sección con tarjeta(s) de álbum enlazando a `/smart-albums/[id]`.  
Si `result.projects.length > 0`, renderizar sección con tarjeta(s) de proyecto enlazando a `/portfolio/[id]`.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/search/classifier.ts` | Extender `ClassifierHints`; añadir intents `smart_album` y `project` |
| `src/lib/search/execute.ts` | `loadHints()` ampliado; estrategias `searchBySmartAlbum` y `searchByProject`; `SearchResult` extendido |
| `src/lib/queries/search.ts` | `SearchSuggestions` con nuevos campos; nuevas queries en `getSearchSuggestions` |
| `src/app/api/search/suggestions/route.ts` | Propagar los nuevos campos al cliente |
| `src/app/search/SearchClient.tsx` | Renderizar secciones de smart albums y proyectos en resultados |
| Componente de autocompletado del buscador | Renderizar secciones nuevas en el dropdown |

---

## Notas de implementación

- Para `searchBySmartAlbum`, reutilizar `getSmartAlbumPhotos()` de `smartAlbums.ts` — no duplicar la lógica de reglas dinámicas.
- Para `searchByProject`, reutilizar la query existente en `projects.ts` que devuelve fotos de un proyecto. Si no existe una función pública, añadirla al repositorio en lugar de poner SQL en `execute.ts`.
- El clasificador solo detecta coincidencia exacta para smart albums y proyectos — la búsqueda parcial se maneja vía `fulltext` + sugerencias del dropdown, no requiriendo un intent dedicado.
- Los hints de smart albums y proyectos se cachean junto a tags y eventos con el mismo `HINTS_TTL_MS` (60 s).
- Si el usuario busca un término que coincide tanto con un evento como con un proyecto, el clasificador prioriza eventos (orden existente: year → tag → event → smart_album → project → fulltext → ai).

---

## Estimación

**Talla: S** — 1–2 sesiones de trabajo.

- Backend (classifier + execute + queries): 1 sesión
- UI (sugerencias + resultados): 0,5–1 sesión
