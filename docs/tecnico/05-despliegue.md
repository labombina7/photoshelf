# Despliegue

## Resumen

photoshelf se distribuye como una imagen Docker multi-stage. El contenedor expone el puerto 3000 y necesita dos volúmenes: uno de solo lectura para las fotos y uno de lectura/escritura para la base de datos y la caché de thumbnails.

## Imagen Docker

La imagen se publica en GitHub Container Registry:

```
ghcr.io/labombina7/photoshelf:latest
```

### Proceso de build (multi-stage)

```dockerfile
# Etapa 1: Builder
FROM node:20-slim AS builder
# Instala dependencias de compilación: python3, make, g++, libvips-dev
# npm ci → npm run build → Next.js standalone output

# Etapa 2: Runner (imagen final slim)
FROM node:20-slim AS runner
# Solo libvips en runtime (para sharp)
# Copia: .next/standalone, .next/static, public
# Copia manualmente: better-sqlite3 (binario nativo)
CMD ["node", "server.js"]
```

La imagen final es slim porque usa el output `standalone` de Next.js, que incluye solo las dependencias necesarias para el servidor.

## docker-compose.yml mínimo

```yaml
services:
  app:
    image: ghcr.io/labombina7/photoshelf:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      APP_PASSWORD: ${APP_PASSWORD}
      SESSION_SECRET: ${SESSION_SECRET}
      PHOTOS_PATH: /photos
      CACHE_PATH: /data/.cache
      DB_PATH: /data/photoshelf.db
      OLLAMA_URL: ${OLLAMA_URL:-http://192.168.1.135:11434}
    volumes:
      - /ruta/local/a/fotos:/photos:ro
      - photoshelf_data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  photoshelf_data:
```

## Volúmenes

| Volumen | Ruta en contenedor | Permisos | Contenido |
|---|---|---|---|
| Fotos | `/photos` | `:ro` (solo lectura) | Estructura `AÑO/EVENTO/*.jpg` |
| Datos | `/data` | lectura/escritura | `photoshelf.db`, `.cache/` de thumbnails |

### Estructura esperada de `/photos`

```
/photos/
├── 2022/
│   ├── Verano/
│   │   ├── IMG_0001.jpg
│   │   └── ...
│   └── Navidad/
│       └── ...
├── 2023/
│   └── ...
└── 2024/
    └── ...
```

photoshelf extrae el año del primer nivel de carpeta y el evento del segundo. Formatos soportados: `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`, `.tif`, `.tiff`.

## Synology NAS (caso de uso típico)

En un NAS Synology con Container Manager:

1. Crear el proyecto desde el `docker-compose.yml`
2. Mapear el volumen de fotos a la carpeta de Photos del NAS (solo lectura)
3. Crear un volumen Docker para `/data`
4. Configurar las variables de entorno en el panel de Container Manager

## Configuración de Ollama (opcional)

Si Ollama corre en otra máquina de la red local (p. ej. un Mac):

```yaml
OLLAMA_URL: http://192.168.1.XXX:11434
```

El modelo necesario es `llama3.2-vision:11b`. Para descargarlo:

```bash
ollama pull llama3.2-vision:11b
```

Si `OLLAMA_URL` no está configurado o no es accesible, todas las funciones de IA se desactivan silenciosamente (sin errores).

## Puertos

| Puerto | Uso |
|---|---|
| `3000` | HTTP de Next.js (interfaz web + API) |

Se recomienda poner un reverse proxy (Nginx, Traefik, SWAG) delante para HTTPS.

## Actualización

```bash
docker compose pull
docker compose up -d
```

La base de datos es persistente en el volumen `photoshelf_data`, por lo que los datos se conservan entre actualizaciones.

## Build local (desarrollo)

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo con hot reload
npm run dev

# Build de producción
npm run build
npm start
```

Variables de entorno para desarrollo local: crear un `.env.local` en la raíz del proyecto con las variables indicadas en la sección de configuración.

## CI/CD

El repositorio usa GitHub Actions para:
1. **Tests** (`npm test`, lint y type-check) — la imagen Docker solo se publica si este job pasa
2. **Build** de la imagen Docker en cada push a `main`
3. **Push** automático a `ghcr.io/labombina7/photoshelf:latest`

Las features se desarrollan en ramas y se mergean a `main` vía Pull Request tras pasar el build de CI. `npm test` debe estar en verde antes de mergear cualquier PR.
