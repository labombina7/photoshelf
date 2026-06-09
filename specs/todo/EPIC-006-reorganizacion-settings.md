# EPIC-006: Reorganización de Settings

## Resumen

Crear una sección de configuración unificada en photoshelf que agrupe en un único lugar
todo lo que actualmente está disperso por la app: catálogos, watcher, backup, integridad
y herramientas. La nueva estructura prepara el terreno para EPIC-007 (configuración de IA),
que añadirá la subsección "Modelos de IA" dentro de este mismo layout.

---

## Motivación

Actualmente la configuración de photoshelf está fragmentada:
- `/settings/catalogs` es la única página bajo `/settings`
- El watcher vive en el Sidebar sin página propia
- Backup tiene API pero no tiene UI
- Integridad está bajo `/tools/integrity`, fuera de ajustes
- No hay ningún lugar centralizado donde el usuario pueda configurar la app

A medida que photoshelf crece (IA, múltiples proveedores, backups automáticos), tener
la configuración dispersa se vuelve insostenible. Esta épica crea la estructura base.

---

## Estructura propuesta

```
/settings
  /settings/general        → Watcher, backup, cambio de contraseña
  /settings/catalogs       → Ya existe, se mantiene (posible refactor de UI)
  /settings/tools          → Integridad de archivos (migrado desde /tools/integrity)
  /settings/ai             → VACÍO en esta épica — reservado para EPIC-007
```

Un layout compartido (`/settings/layout.tsx`) renderiza la navegación lateral
con las subsecciones. Activo según la ruta.

---

## Historias hijas

| ID | Título | Esfuerzo | Prerequisitos |
|----|--------|----------|--------------|
| US-A | Layout base de Settings con navegación por subsecciones | S | — |
| US-B | Subsección General: watcher + backup + contraseña | M | US-A |
| US-C | Migrar Catálogos al nuevo layout | S | US-A |
| US-D | Subsección Herramientas: migrar integridad desde /tools | S | US-A |
| US-E | Limpiar sidebar y navegación — eliminar entradas duplicadas | S | US-B, US-C, US-D |

---

## Detalle por subsección

### General
- **Watcher**: toggle de vigilancia de carpetas + estado actual (activo/inactivo). Actualmente solo accesible desde el sidebar.
- **Backup**: configuración de backup automático (intervalo, activar/desactivar) + botón de backup manual + historial de últimos backups. La API ya existe, falta la UI.
- **Contraseña**: cambio de contraseña de acceso.

### Catálogos
- Migrar la UI existente de `/settings/catalogs` al nuevo layout sin cambios funcionales.

### Herramientas
- Migrar la página de integridad desde `/tools/integrity` a `/settings/tools`.
- Redirigir `/tools/integrity` → `/settings/tools` para no romper bookmarks.
- Evaluar si `/tools/roadmap` también encaja aquí o se elimina.

### IA *(reservado)*
- La subsección aparece en la navegación como enlace a `/settings/ai`.
- En esta épica muestra una pantalla placeholder: *"Configuración de modelos de IA — próximamente"*.
- EPIC-007 implementa el contenido real.

---

## Cambios en navegación

- El sidebar elimina el enlace directo a `/settings/catalogs` y lo reemplaza por `/settings`
- El enlace a `/tools/integrity` en el sidebar apunta a `/settings/tools`
- El watcher en el sidebar se mantiene como indicador de estado visual, pero la configuración vive en `/settings/general`

---

## Criterios de éxito

- Existe un único punto de entrada `/settings` con navegación a todas las subsecciones
- Todo lo que antes estaba disperso está accesible desde `/settings`
- No se pierde ninguna funcionalidad existente
- Las URLs antiguas redirigen correctamente (no se rompen bookmarks)
- El layout es coherente con el resto de la app (variables CSS, sin Tailwind)

---

## Fuera de alcance

- Configuración de IA (EPIC-007)
- Gestión de usuarios múltiples
- Exportación de configuración
- Cualquier cambio funcional en las secciones migradas (solo reubicación)
