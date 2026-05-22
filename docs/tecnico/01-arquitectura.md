# Arquitectura del sistema

## Visión general

photoshelf es una aplicación web **monolítica** construida con Next.js 14 App Router. El servidor sirve tanto la interfaz de usuario (React Server Components + Client Components) como la API REST. No hay servicios separados — todo corre en un único proceso Node.js.

```mermaid
graph TB
    Browser["🌐 Navegador"]
    
    subgraph Container["Contenedor Docker"]
        subgraph Next["Next.js 14 (Node.js)"]
            RSC["Server Components\n(páginas)"]
            API["API Routes\n(/api/*)"]
            Client["Client Components\n(UI interactiva)"]
        end
        
        subgraph Libs["Librerías servidor"]
            Scanner["Scanner\n(exifr + fs)"]
            Thumb["Thumbnail\n(sharp)"]
            Watcher["Folder Watcher\n(fs.watch)"]
            Session["Session\n(iron-session)"]
        end
        
        DB[("SQLite\n(better-sqlite3)")]
        Cache["Cache de thumbnails\n(WebP en disco)"]
    end
    
    subgraph External["Externos (opcionales)"]
        Ollama["Ollama\nllama3.2-vision:11b"]
        OSM["OpenStreetMap\n(tiles de mapa)"]
    end
    
    PhotosVol[("📁 Volumen de fotos\n/photos")]
    
    Browser <-->|"HTTP/HTTPS"| Next
    RSC --> DB
    API --> DB
    API --> Scanner
    API --> Thumb
    API --> Watcher
    Scanner --> PhotosVol
    Scanner --> DB
    Thumb --> PhotosVol
    Thumb --> Cache
    Watcher --> PhotosVol
    API -.->|"OLLAMA_URL"| Ollama
    Client -.->|"tiles"| OSM
```

## Capas de la aplicación

### 1. Presentación (UI)

- **Server Components**: cargan datos directamente de SQLite en el servidor, renderizan HTML inicial
- **Client Components**: interactividad (formularios, modales, zoom, mapa)
- **API Routes**: endpoints REST para operaciones desde el cliente

### 2. Lógica de negocio

- **`scanner.ts`**: recorre el filesystem, extrae EXIF y sincroniza la base de datos
- **`thumbnail.ts`**: genera y cachea miniaturas WebP con sharp
- **`folderWatcher.ts`**: monitorización de carpetas nuevas, debounce, auto-scan y auto-classify
- **`ollama.ts`**: cliente para classify, review, search y generación de proyectos
- **`session.ts`**: autenticación con iron-session

### 3. Datos

- **SQLite** (better-sqlite3): base de datos embebida, WAL mode, claves foráneas activadas
- **Disco**: fotos originales en `/photos`, thumbnails cacheados en `/data/.cache`

## Flujo de petición típico

```mermaid
sequenceDiagram
    participant B as Navegador
    participant RSC as Server Component
    participant API as API Route
    participant DB as SQLite
    participant FS as Filesystem

    B->>RSC: GET /library
    RSC->>DB: SELECT fotos, temas, proyectos
    DB-->>RSC: datos
    RSC-->>B: HTML con datos

    B->>API: GET /api/photos/[id]/thumbnail?size=200
    API->>FS: ¿existe caché?
    alt caché hit
        FS-->>API: WebP cacheado
    else caché miss
        API->>FS: leer foto original
        API->>API: sharp → WebP
        API->>FS: guardar en .cache/
    end
    API-->>B: imagen WebP
```

## Proceso de escaneo

```mermaid
sequenceDiagram
    participant W as Watcher / UI
    participant S as Scanner
    participant E as exifr
    participant DB as SQLite

    W->>S: scanLibrary(photosRoot)
    S->>S: countEvents() — iterar años/eventos
    loop Por cada evento
        S->>E: extractExif(foto.jpg)
        E-->>S: fecha, cámara, GPS, exposición
        S->>DB: UPSERT photo (path UNIQUE)
    end
    S-->>W: { added, total }
    
    opt OLLAMA_URL configurado
        W->>W: classifyPhoto() — fotos sin tags
    end
```

## Gestión de estado del servidor

Para operaciones asíncronas de larga duración (escaneo, clasificación), el servidor usa **módulos singleton** con estado en memoria:

```
scanState.ts      → { running, done, total, currentEvent, error }
classifyState.ts  → { running, done, total, year, error }
watcherState.ts   → { enabled, watching, classifying, classifyDone, classifyTotal }
```

El cliente hace polling cada 2 segundos a `/api/scan/status` y `/api/watcher/status` para mostrar el progreso en el toast.

## Startup

`src/instrumentation.ts` (hook de Next.js) inicia el `folderWatcher` al arrancar el servidor Node.js, antes de servir cualquier petición.
