# Configuración

Todas las variables de entorno son opcionales salvo `APP_PASSWORD` y `SESSION_SECRET`, que son obligatorias para el funcionamiento seguro de la aplicación.

## Variables de entorno

| Variable | Obligatoria | Valor por defecto | Descripción |
|---|---|---|---|
| `APP_PASSWORD` | Sí | — | Contraseña única de acceso a la app |
| `SESSION_SECRET` | Sí | — | Secreto para firmar la cookie de sesión (mínimo 32 caracteres) |
| `PHOTOS_PATH` | No | `/photos` | Ruta donde están montadas las fotos |
| `DB_PATH` | No | `/data/photoshelf.db` | Ruta del archivo SQLite |
| `CACHE_PATH` | No | `/data/.cache` | Directorio para la caché de thumbnails WebP |
| `OLLAMA_URL` | No | — | URL base de Ollama (p. ej. `http://192.168.1.10:11434`) |

## Detalle de cada variable

### `APP_PASSWORD`

La contraseña que el usuario escribe en la pantalla de login. No hay sistema de usuarios — una sola contraseña para toda la instancia.

```
APP_PASSWORD=mi_contraseña_segura
```

### `SESSION_SECRET`

Secreto criptográfico usado por `iron-session` para firmar y verificar la cookie de sesión. Debe ser aleatorio y de al menos 32 caracteres.

Generar uno con:
```bash
openssl rand -hex 32
```

```
SESSION_SECRET=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

### `PHOTOS_PATH`

Ruta dentro del contenedor donde están las fotos. En el `docker-compose.yml` se mapea el directorio local a esta ruta.

La estructura esperada es `PHOTOS_PATH/AÑO/EVENTO/foto.ext`. El año debe ser un número de 4 dígitos.

```
PHOTOS_PATH=/photos
```

### `DB_PATH`

Ruta completa al archivo SQLite. El directorio padre debe existir y tener permisos de escritura.

```
DB_PATH=/data/photoshelf.db
```

### `CACHE_PATH`

Directorio donde se guardan las miniaturas WebP generadas por `sharp`. Se crea automáticamente si no existe. La estructura interna es:

```
.cache/
└── {id}_{size}.webp
```

```
CACHE_PATH=/data/.cache
```

### `OLLAMA_URL`

URL base del servidor Ollama. Si no se configura, todas las funciones de IA están desactivadas:
- La clasificación automática no ocurre al escanear
- El botón de clasificación manual no aparece
- La búsqueda con IA no está disponible
- La revisión de foto (composición, luz, puntuación) no aparece
- La generación de portfolios con IA no está disponible

```
OLLAMA_URL=http://192.168.1.135:11434
```

El modelo usado es `llama3.2-vision:11b`. Debe estar descargado en el servidor Ollama antes de usar cualquier función de IA.

## Archivo `.env.local` (desarrollo)

Para desarrollo local, crear un `.env.local` en la raíz del proyecto:

```bash
# .env.local
APP_PASSWORD=dev_password
SESSION_SECRET=dev_secret_32_chars_minimum_here_xx
PHOTOS_PATH=/Users/miusuario/Photos
DB_PATH=/Users/miusuario/photoshelf-dev.db
CACHE_PATH=/Users/miusuario/.photoshelf-cache
OLLAMA_URL=http://localhost:11434
```

Este archivo no debe commitearse (está en `.gitignore`). Usar `.env.example` como plantilla.

## Seguridad

- La cookie de sesión tiene `httpOnly: true`, `secure: true` (en producción) y `sameSite: 'strict'`
- La sesión expira a los 7 días (`maxAge: 7 * 24 * 60 * 60`)
- Todos los endpoints de la API verifican la sesión antes de procesar la petición
- El volumen de fotos se monta en modo solo lectura (`:ro`) — photoshelf nunca modifica las fotos originales
