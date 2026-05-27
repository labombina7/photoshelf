# Feature: Persistencia del DB fuera del volumen Docker

> Estado: ✅ Desplegada

## Historia de usuario

Como administrador de photoshelf,
quiero que el archivo `photoshelf.db` se almacene en una ruta del NAS visible para Hyper Backup y snapshots de Synology,
para que ante una migración problemática o corrupción de datos pueda restaurar el estado anterior sin pérdida.

---

## Contexto

El DB está actualmente en un volumen Docker nombrado (`photoshelf_photoshelf_data`), almacenado en `/volume1/@docker/volumes/`. Esta ruta no está cubierta por los snapshots automáticos de Synology ni por Hyper Backup, lo que impide recuperar datos en caso de fallo de migración.

Incidente: migración de mayo 2026 borró todas las relaciones `photo_tags` vía `ON DELETE CASCADE`. No existía backup recuperable.

---

## Criterios de aceptación

- El `docker-compose.yml` usa un bind mount para `/data` apuntando a una carpeta en `/volume1/homes/javi/photoshelf-data/` (o ruta equivalente configurable)
- El volumen nombrado `photoshelf_data` se elimina del compose
- La carpeta de datos del NAS tiene permisos correctos para el proceso del contenedor
- La migración de datos existentes (mover el `.db` y `.cache` del volumen antiguo al bind mount) está documentada en el README o en un script
- La ruta del bind mount es configurable vía variable de entorno o `.env` para facilitar distintos entornos de despliegue

## Tareas técnicas

1. Cambiar `volumes:` en `docker-compose.yml`:
   ```yaml
   volumes:
     - ${DATA_PATH:-/volume1/homes/javi/photoshelf-data}:/data
   ```
2. Eliminar la sección `volumes:` de nivel raíz del compose
3. Documentar el procedimiento de migración del volumen antiguo al nuevo bind mount
4. Verificar que los permisos del directorio host permiten escritura al usuario del contenedor (Next.js corre como `node`, UID 1000)
