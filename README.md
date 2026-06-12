# photoshelf

Gestor de fotos self-hosted para Synology NAS. Indexa carpetas locales, genera miniaturas, clasifica con IA (Ollama) y expone una API REST para clientes iOS.

## Despliegue en Synology (Docker Compose)

### 1. Preparar directorios

```bash
# Crear carpeta de datos (debe ser escribible por UID 1000 — usuario node del contenedor)
mkdir -p /volume1/homes/javi/photoshelf-data
chown 1000:1000 /volume1/homes/javi/photoshelf-data
```

### 2. Crear `.env`

```bash
cp .env.example .env
# Editar APP_PASSWORD, SESSION_SECRET, OLLAMA_URL y DATA_PATH
```

### 3. Arrancar

```bash
docker compose up -d
```

La app queda disponible en `http://<NAS-IP>:3000`.

---

## Migración desde volumen Docker nombrado

Si venías usando una versión anterior con `photoshelf_data` (volumen nombrado), migra los datos antes de arrancar:

```bash
# 1. Parar la app
docker compose down

# 2. Copiar datos del volumen antiguo al nuevo bind mount
docker run --rm \
  -v photoshelf_photoshelf_data:/old \
  -v /volume1/homes/javi/photoshelf-data:/new \
  busybox sh -c "cp -a /old/. /new/"

# 3. Ajustar permisos
chown -R 1000:1000 /volume1/homes/javi/photoshelf-data

# 4. Arrancar con el nuevo compose
docker compose up -d

# 5. Verificar que la app arranca y las fotos siguen visibles
# Una vez confirmado, eliminar el volumen antiguo:
docker volume rm photoshelf_photoshelf_data
```

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `APP_PASSWORD` | Contraseña de login | `s3cr3t` |
| `SESSION_SECRET` | Secreto de sesión (≥32 chars) | `openssl rand -hex 32` |
| `OLLAMA_URL` | URL de la instancia Ollama | `http://192.168.1.135:11434` |
| `DATA_PATH` | Ruta host para DB y caché | `/volume1/homes/javi/photoshelf-data` |

### Concurrencia Ollama (clasificación paralela)

photoshelf clasifica fotos en lotes de 2 en paralelo. Para que Ollama acepte esos requests simultáneos hay que arrancar el servidor con:

```bash
OLLAMA_NUM_PARALLEL=2 ollama serve
```

Valor recomendado para **M1 16GB con llava:7b**: `2`. No subir a 3 o más — el KV cache adicional presiona la memoria unificada y puede activar swap, empeorando el rendimiento.

---

## Desarrollo local

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # build de producción
npm test          # tests
```

**`npm test` debe pasar antes de mergear.** El CI ejecuta tests, lint y type-check en cada pull request, y la imagen Docker solo se publica si el job de tests pasa (`needs: test`).

La base de datos en desarrollo se crea en `data/photoshelf.db` (configurable con `DB_PATH`).
