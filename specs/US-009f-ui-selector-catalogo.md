# Feature: US-009f — UI: selector de catálogo en el Sidebar

## Historia de usuario

Como usuario de photoshelf con múltiples catálogos,
quiero un selector rápido de catálogo en el sidebar,
para cambiar entre mis bibliotecas de fotos con un solo clic.

---

## Descripción

Añade un selector de catálogo en la parte superior del Sidebar. Muestra el catálogo activo
y permite cambiar al otro con un dropdown o lista desplegable. Al seleccionar, llama a
`POST /api/catalogs/switch` y recarga las vistas sin recargar la página completa.

---

## Criterios de aceptación

### Selector visual
- [ ] En el Sidebar, encima de la navegación principal, aparece el nombre del catálogo activo
  con un icono de dropdown (chevron)
- [ ] Al pulsar, se abre una lista de catálogos disponibles con el activo marcado (checkmark)
- [ ] Al seleccionar un catálogo diferente, se llama a `POST /api/catalogs/switch`
- [ ] Tras el switch, todas las vistas se recargan con el nuevo catálogo (usando `router.refresh()`)

### Usabilidad
- [ ] Si sólo hay un catálogo, el selector se muestra como texto estático (sin dropdown)
- [ ] El nombre del catálogo se trunca con ellipsis si es demasiado largo para el sidebar
- [ ] El dropdown se cierra al pulsar fuera o al seleccionar un catálogo

### Acceso a gestión
- [ ] Debajo de la lista de catálogos hay un enlace "Gestionar catálogos" que navega a `/settings/catalogs`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/CatalogSwitcher.tsx` | Nuevo — selector de catálogo para el Sidebar |
| `src/components/Sidebar.tsx` | Incluir `<CatalogSwitcher>` en la parte superior |

---

## Notas técnicas

- El estado del catálogo activo se obtiene del endpoint `GET /api/catalogs` (cacheado en el cliente)
- Usar `useRouter().refresh()` de Next.js para recargar los Server Components sin full reload
- El dropdown puede implementarse con un `<details>/<summary>` o con un pequeño estado de React

---

## Fuera de alcance

- Reordenar catálogos con drag & drop
- Iconos o colores personalizados por catálogo
- Crear nuevo catálogo desde el selector (sólo desde la página de gestión)
