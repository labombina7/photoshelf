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
| `BACKUP_PATH` | No | `/data/backups` | Directorio para las copias de seguridad automáticas de la BD |
| `OLLAMA_URL` | No | — | URL base de Ollama (p. ej. `http://192.168.1.10:11434`) |
| `OLLAMA_TEXT_MODEL` | No | `llama3:latest` | Modelo de texto para síntesis de insights y análisis de estilo |
| `COOKIE_SECURE` | No | `true` en producción | Fuerza `secure: true` en la cookie de sesión (desactivar en HTTP local) |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | No | — | API key de Amplitude para analytics de uso (cliente) |
| `AMPLITUDE_API_KEY` | No | — | API key de Amplitude para sync server-side de metadatos EXIF |

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
- El análisis de estilo fotográfico no genera narrativas

```
OLLAMA_URL=http://192.168.1.135:11434
```

Se usan dos modelos de Ollama:
- **Visión** (clasificación de fotos): `llama3.2-vision:11b` (configurable en código)
- **Texto** (síntesis de insights): configurable con `OLLAMA_TEXT_MODEL`, por defecto `llama3:latest`

Ambos modelos deben estar descargados en el servidor Ollama antes de usar las funciones correspondientes.

### `OLLAMA_TEXT_MODEL`

Modelo de texto para las síntesis de análisis de estilo (EPIC-004). No se usa para clasificación de fotos.

```
OLLAMA_TEXT_MODEL=llama3.2:3b
```

### `BACKUP_PATH`

Directorio donde se guardan las copias de seguridad automáticas de la base de datos. El backup se ejecuta automáticamente al arrancar si lleva más de 24h desde el último. Se conservan los últimos 10 backups.

```
BACKUP_PATH=/data/backups
```

### `NEXT_PUBLIC_AMPLITUDE_API_KEY` y `AMPLITUDE_API_KEY`

Opcionales. Si se configuran, photoshelf envía eventos de analytics a Amplitude. `NEXT_PUBLIC_AMPLITUDE_API_KEY` registra eventos de navegación en el cliente; `AMPLITUDE_API_KEY` se usa para el endpoint de sync de metadatos EXIF desde el servidor.

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
