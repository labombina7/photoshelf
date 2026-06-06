# Feature: Backup automático activado por defecto y aviso en UI de ajustes

## Historia de usuario

Como usuario que instala photoshelf por primera vez,
quiero que los backups automáticos estén habilitados sin necesidad de configuración manual,
para que mis metadatos (tags, proyectos, favoritos) estén protegidos desde el primer día sin leer la documentación.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó que `auto_enabled = 0` es el valor por defecto de la tabla `backup_config`. El sistema de backup manual está completamente implementado (US-072), pero un usuario que instale la app y no explore los ajustes nunca tendrá backups automáticos.

Dado que el NAS donde se despliega photoshelf tiene típicamente espacio abundante y el backup ocupa poco (SQLite comprimido + JSON de tags), el riesgo de activarlo por defecto es mínimo comparado con el riesgo de no tener ningún backup.

**Cambios propuestos**:

1. **Cambiar el default en la migración**: modificar `migrateBackupConfig` en `db.ts` para insertar `auto_enabled = 1, auto_interval_days = 7` en lugar de `auto_enabled = 0`. El `INSERT OR IGNORE` existente garantiza que la instalaciones ya en producción no se ven afectadas (el registro ya existe).

2. **Aviso en la UI de ajustes**: si el backup automático está desactivado, mostrar un banner de advertencia en la página de ajustes de catálogos (`/settings/catalogs`) con un enlace directo a la sección de backup.

---

## Criterios de aceptación

### Default activado para instalaciones nuevas
- [ ] Una instalación limpia (BD nueva) tiene `auto_enabled = 1` y `auto_interval_days = 7`
- [ ] Las instalaciones existentes (BD con registro ya insertado) no ven ningún cambio
- [ ] El primer backup automático se ejecuta correctamente a los 7 días del arranque

### Aviso en UI
- [ ] Si `auto_enabled = 0`, aparece un banner de advertencia en `/settings/catalogs` con texto tipo: "Los backups automáticos están desactivados. Actívalos para proteger tus datos."
- [ ] El banner tiene un botón "Activar ahora" que activa el backup con `auto_interval_days = 7` sin necesidad de navegar a otra página
- [ ] Si `auto_enabled = 1`, el banner no aparece
- [ ] El banner es dismissable (el usuario puede cerrarlo) y no vuelve a aparecer en la misma sesión

### Sin regresiones
- [ ] El sistema de backup manual sigue funcionando igual
- [ ] Los tests de backup existentes siguen pasando

---

## API necesaria

No se requieren endpoints nuevos. El endpoint `PATCH /api/backup/config` ya existe y acepta `{ auto_enabled, auto_interval_days }`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/db.ts` | Cambiar default `auto_enabled = 0` → `auto_enabled = 1` en `migrateBackupConfig` |
| `src/app/settings/catalogs/CatalogsClient.tsx` | Añadir banner de aviso si backup automático desactivado |

---

## Notas técnicas

- El `INSERT OR IGNORE INTO backup_config (id) VALUES (1)` solo inserta si no existe el registro — instalaciones existentes ya tienen `id = 1`, por lo que el cambio de default no les afecta
- El banner puede obtener el estado del backup de la llamada a `fetch('/api/backup/status')` que ya se hace al cargar `CatalogsClient`
- El dismiss puede implementarse con un estado local `useState` sin persistencia (se muestra de nuevo si el usuario recarga y el backup sigue desactivado — esto es intencional)

---

## Fuera de alcance (v1)

- Notificaciones push o email cuando un backup falla
- Backup a almacenamiento en la nube (S3, Backblaze)
- Configuración del intervalo de backup desde el banner (solo el botón "Activar con 7 días")
