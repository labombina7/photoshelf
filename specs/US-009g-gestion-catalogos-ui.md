# Feature: Gestión de catálogos desde la UI

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009b](US-009b-api-crud-catalogos.md) + [US-009f](US-009f-sidebar-arbol-catalogos.md)

---

## Historia de usuario

Como fotógrafo que quiere conectar la biblioteca del móvil a photoshelf,
quiero añadir, renombrar y eliminar catálogos directamente desde la interfaz
sin necesidad de editar variables de entorno ni reiniciar el servidor,
para poder gestionar mis fuentes de fotos de forma autónoma.

---

## Descripción

Esta historia cierra la épica añadiendo la UI de gestión de catálogos. El punto de entrada es
un botón "Añadir catálogo" en la parte inferior del sidebar (en la zona de acciones junto a
"Reescanear biblioteca"). Al pulsarlo se abre un modal donde el usuario introduce la ruta,
el nombre y el modo de escaneo.

Las opciones de renombrar y eliminar aparecen en un menú contextual (hover) sobre cada sección
de catálogo en el sidebar, siguiendo el mismo patrón que ya existe para las temáticas
(`editingId`, botones de icono en hover).

El catálogo por defecto (`id = 1`) no puede eliminarse — el botón de eliminación está oculto
para él. Sí puede renombrarse y cambiar de color.

---

## Criterios de aceptación

### Añadir catálogo

- [ ] Botón "Añadir catálogo" visible en el sidebar (zona inferior, junto a "Reescanear biblioteca")
- [ ] Al pulsarlo se abre un modal con los campos: Nombre, Ruta del directorio, Modo de escaneo
  (radio o select: `Estructurado (año/evento)` / `Plano (cualquier estructura)`), Color (color picker)
- [ ] El campo de ruta muestra un placeholder con ejemplo: `/nas/mobile`
- [ ] El modal valida que todos los campos obligatorios estén rellenos antes de enviar
- [ ] Al confirmar, se llama a `POST /api/catalogs`; si la ruta no existe en el servidor, se muestra
  el mensaje de error devuelto por la API bajo el campo de ruta
- [ ] Tras crear el catálogo, el modal se cierra, el sidebar se actualiza con la nueva sección
  y se muestra un toast "Catálogo añadido. Escanea para indexar las fotos."
- [ ] El toast incluye un botón de acción "Escanear ahora" que dispara `POST /api/scan` con el
  `catalogId` del nuevo catálogo

### Renombrar catálogo

- [ ] Al hacer hover sobre la cabecera de un catálogo en el sidebar, aparece un icono de edición
- [ ] Al pulsarlo, la cabecera se convierte en un input inline (mismo patrón que la edición de temáticas)
- [ ] Al confirmar (Enter o botón Guardar), se llama a `PATCH /api/catalogs/[id]` con el nuevo nombre
- [ ] Si se pulsa Escape o se cancela, se descarta el cambio

### Cambiar color de catálogo

- [ ] El input de edición inline del catálogo incluye un `<input type="color">` para cambiar el color,
  igual que el formulario de edición de temáticas
- [ ] El punto de color en el sidebar se actualiza en tiempo real al cambiar el picker

### Eliminar catálogo

- [ ] Al hacer hover sobre la cabecera de un catálogo aparece, junto al icono de edición, un icono
  de papelera (solo para catálogos con `id !== 1`)
- [ ] Al pulsarlo se muestra un modal de confirmación:
  "¿Eliminar «Móvil (NAS)»? Se eliminarán 1.830 fotos de la base de datos.
  Los archivos físicos no se tocarán."
- [ ] El modal muestra el conteo real de fotos que se perderán (obtenido de `photo_count`)
- [ ] Al confirmar se llama a `DELETE /api/catalogs/[id]`; el sidebar se actualiza y se muestra
  un toast "Catálogo eliminado"
- [ ] Si el catálogo eliminado era el activo en el timeline, la selección vuelve a `'all'`

### Reescanear desde el sidebar (multi-catálogo)

- [ ] Con múltiples catálogos, el botón "Reescanear biblioteca" se convierte en un dropdown:
  "Reescanear [nombre catálogo activo]" + "Reescanear todos"
- [ ] Cada opción llama a `POST /api/scan` con el `catalogId` correspondiente (o sin él para "todos")

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Sidebar.tsx` | Botón "Añadir catálogo", menú de hover sobre secciones, dropdown de escaneo |
| `src/components/AddCatalogModal.tsx` | Modal de alta de catálogo (nuevo componente) |

---

## Notas técnicas

### Modal `AddCatalogModal`

Reutiliza el sistema de modales existente (`ModalProvider` / `useModal`) para el modal de
confirmación de eliminación. El modal de creación es un componente propio (no usa `confirm`)
porque necesita un formulario con múltiples campos y validación de error en el campo de ruta.

```tsx
// Estructura básica del modal de creación
<div className="modal-overlay" onClick={onClose}>
  <div className="modal" onClick={e => e.stopPropagation()}>
    <h2>Añadir catálogo</h2>
    <label>Nombre<input value={name} onChange={...} /></label>
    <label>
      Ruta del directorio
      <input value={rootPath} onChange={...} placeholder="/nas/mobile" />
      {pathError && <span className="field-error">{pathError}</span>}
    </label>
    <label>Modo de escaneo
      <select value={scanMode} onChange={...}>
        <option value="structured">Estructurado (año / evento / fotos)</option>
        <option value="flat">Plano (cualquier estructura de carpetas)</option>
      </select>
    </label>
    <div className="modal-actions">
      <button onClick={onClose}>Cancelar</button>
      <button onClick={handleCreate} disabled={creating}>
        {creating ? 'Creando…' : 'Crear catálogo'}
      </button>
    </div>
  </div>
</div>
```

### Toast con acción "Escanear ahora"

El sistema de toasts actual (si existe) o un toast simple estilo `alert` con botón de acción.
Si no existe un sistema de toasts, se puede implementar como un banner temporal en el sidebar
que desaparece tras 5 s o al hacer clic en "Escanear ahora".

### Dropdown de reescaneo

Con un único catálogo, el botón sigue siendo igual que hoy (sin dropdown). El dropdown
aparece solo con ≥ 2 catálogos, siguiendo el mismo principio de visibilidad condicional que
el selector de pills del timeline.

---

## Estrategia de coexistencia

Esta historia es la última de la épica y la única que introduce gestión activa de catálogos.
Hasta que el usuario pulse "Añadir catálogo" y complete el formulario, no hay ningún cambio
observable en el comportamiento de la aplicación.

La historia puede desplegarse con todas las anteriores completas y el sistema seguirá
funcionando exactamente igual que hoy para instalaciones con un único catálogo.

---

## Fuera de alcance

- Editar `root_path` o `scan_mode` de un catálogo existente (demasiado destructivo para v1)
- Importar catálogos desde un archivo de configuración JSON
- Reordenar catálogos mediante drag & drop
- Página de settings dedicada a catálogos (el sidebar es suficiente para v1)
