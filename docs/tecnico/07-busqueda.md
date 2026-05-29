# Sistema de búsqueda (EPIC-003)

El sistema de búsqueda unificado de photoshelf (implementado en EPIC-003, US-028–034) clasifica automáticamente la intención de cada consulta y enruta al modo de procesamiento más adecuado.

## Arquitectura general

```mermaid
graph TB
    subgraph Header["AppHeader (cliente)"]
        Input["SearchBar input"]
        Dropdown["SearchDropdown\n(historial + sugerencias)"]
        Classifier["classifyQuery()\nsrc/lib/search/classifier.ts"]
    end

    subgraph Search["Búsqueda en servidor"]
        API["/api/search\n(GET ?q=&mode=)"]
        Executor["executeSearch()\nsrc/lib/search/execute.ts"]
        HintsAPI["/api/search/hints"]
        SuggestAPI["/api/search/suggestions"]
    end

    subgraph Results["/search (SearchClient)"]
        Photos["SearchPhotoGrid"]
        Tags["TagsSection"]
        Events["EventsSection"]
        Deep["DeepSearchPanel\n(búsqueda visual IA)"]
        Save["SaveThemePanel"]
    end

    subgraph DataSources["Datos"]
        DB[("SQLite")]
        LS["localStorage\n(historial)"]
        Ollama["Ollama\nllama3.2-vision:11b"]
    end

    Input --> Classifier
    Classifier -->|"tag / event / year"| Library["/library?filtro=valor"]
    Classifier -->|"text / ai"| API
    API --> Executor
    Executor --> DB
    Executor --> Results
    HintsAPI --> DB
    HintsAPI -->|"tags + events"| Classifier
    SuggestAPI --> DB
    SuggestAPI --> Dropdown
    Dropdown --> LS
    Deep --> Ollama
    Save --> DB
```

## Clasificador de intención (`src/lib/search/classifier.ts`)

El clasificador corre **en el cliente**, sin llamada al servidor. Analiza el texto con reglas locales + hints precargados:

```mermaid
flowchart TD
    Q["Consulta del usuario"] --> R1{¿es un número\nde 4 dígitos?}
    R1 -->|Sí| Y["intent: year\nnavega a /library?year=N"]
    R1 -->|No| R2{¿coincide con\nun tag conocido?}
    R2 -->|Sí| T["intent: tag\nnavega a /library?tag=X"]
    R2 -->|No| R3{¿coincide con\nun evento conocido?}
    R3 -->|Sí| E["intent: event\nnavega a /library?event=X"]
    R3 -->|No| R4{¿parece una\nconsulta visual?}
    R4 -->|Sí| AI["intent: ai\nnavega a /search?q=X"]
    R4 -->|No| TX["intent: text\nnavega a /search?q=X"]
```

Los **hints** (`{ tags: string[], events: string[] }`) se cargan una sola vez al montar el `AppHeader` desde `/api/search/hints` y se mantienen en memoria durante la sesión.

## Ejecutor de búsqueda (`src/lib/search/execute.ts`)

Corre en el servidor, dentro del Server Component de `/search`. Recibe la consulta y el catálogo activo y devuelve tres tipos de resultados:

| Campo | Descripción |
|---|---|
| `photos: SearchPhotoRow[]` | Fotos que coinciden (por nombre de archivo, evento o tag) |
| `tags: TagMatch[]` | Tags que contienen el texto de la consulta |
| `events: EventMatch[]` | Eventos que contienen el texto de la consulta |

## Búsqueda profunda con IA

La búsqueda profunda analiza visualmente cada foto con Ollama. Es un proceso batch que el cliente coordina directamente desde `DeepSearchPanel`:

```mermaid
sequenceDiagram
    participant SC as SearchClient
    participant API as /api/ai/search
    participant Ollama

    SC->>API: POST { query, mode: 'deep', offset: 0 }
    loop Por cada foto
        API->>Ollama: ¿esta foto muestra "{query}"?
        Ollama-->>API: { match: true/false, tags: [] }
        API-->>SC: { photos: [...], hasMore, nextOffset }
    end
    SC->>SC: acumular resultados y renderizar
```

El cliente hace llamadas sucesivas incrementando el `offset` hasta que `hasMore = false`. Los resultados se muestran en streaming conforme llegan.

## Historial y autocompletado

### Historial (`localStorage`)

- Se guarda en `photoshelf:search-history` como array JSON de strings
- Máximo 10 entradas, FIFO
- Se muestra en el `SearchDropdown` cuando el input está vacío o al enfocar

### Sugerencias (`/api/search/suggestions`)

Endpoint que devuelve tags y eventos del catálogo activo que contienen el texto escrito. Se llama con debounce de ~200 ms mientras el usuario escribe.

```json
{
  "tags": ["b&w", "blanco y negro"],
  "events": ["Boda Julia y Marc", "Black Friday 2023"]
}
```

## Sincronización header ↔ página de resultados

La página `/search` y el `AppHeader` deben mostrar siempre el mismo texto. La sincronización se hace con un **Custom Event del DOM** (sin estado global):

```
SearchClient monta → dispara photoshelf:search-sync con el ?q= actual
AppHeader escucha el evento → actualiza el texto del input
```

Esto permite que el input del header refleje la consulta activa aunque el usuario haya navegado directamente a `/search?q=xyz`.

## Componentes involucrados

| Componente | Responsabilidad |
|---|---|
| `AppHeader.tsx` | Input, clasificador, historial, navegación |
| `SearchDropdown.tsx` | Overlay de sugerencias e historial |
| `HeaderSlot.tsx` | Portal para inyectar controles de página en el header |
| `src/app/search/page.tsx` | Server Component: ejecuta `executeSearch`, pasa result |
| `src/app/search/SearchClient.tsx` | Renderiza resultados, gestiona búsqueda profunda y guardado |
| `src/lib/search/classifier.ts` | Clasificador de intención (cliente) |
| `src/lib/search/execute.ts` | Ejecutor de búsqueda (servidor) |

## Hooks de soporte

| Hook | Propósito |
|---|---|
| `useSearchHistory` | Lee/escribe historial en localStorage |
| `useSearchShortcut` | Escucha `/` y enfoca el input del header |
