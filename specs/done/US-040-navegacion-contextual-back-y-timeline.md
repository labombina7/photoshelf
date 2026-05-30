# Feature: Navegación contextual — botón "atrás" preserva estado y enlace a biblioteca desde Timeline

> Estado: ✅ Desplegada — PR #80 mergeada el 2026-05-30

## Historia de usuario

Como fotógrafo navegando entre fotos y la biblioteca,
quiero que el botón "atrás" me devuelva exactamente al estado y posición donde estaba antes de abrir el detalle de una foto,
para no perder el filtro activo, el año seleccionado o la posición de scroll cada vez que entro y salgo de una foto.

---

## Descripción

Actualmente el botón "atrás" en el detalle de foto (`PhotoDetailClient.tsx`) construye la URL de retorno en el servidor usando `backHref` y `backLabel`. Aunque preserva la query string de navegación (`navSearch`), el usuario pierde información crucial cuando llega al detalle desde secciones distintas a la biblioteca: si viene desde la Timeline, el botón no aparece como "Volver a Timeline"; si vino con un filtro de año activo, ese contexto puede no estar del todo preservado.

Adicionalmente, la Timeline no ofrece ningún enlace discreto "Ver estas fotos en la biblioteca" desde los headers de período, lo que obliga al usuario a navegar a la biblioteca manualmente y replicar el filtro.

---

## Criterios de aceptación

### Botón "atrás" preserva URL exacta de origen
- [ ] Al navegar desde cualquier sección al detalle de foto, la URL de origen se guarda en `sessionStorage` con la clave `photoshelf_detail_origin`
- [ ] Al pulsar "atrás" en `PhotoDetailClient.tsx`, se lee `photoshelf_detail_origin` de `sessionStorage` y se usa esa URL para navegar (en lugar del `backHref` construido en servidor)
- [ ] Si no hay entrada en `sessionStorage` (acceso directo a la URL del detalle), se usa el `backHref` del servidor como fallback
- [ ] La entrada de `sessionStorage` se limpia al usar el botón "atrás" para no reutilizarla en navegaciones posteriores

### Label del botón refleja la sección de origen
- [ ] El label del botón muestra la sección real de origen cuando está disponible: "Timeline", "Biblioteca", "Búsqueda", "Mapa"
- [ ] El label se extrae de `sessionStorage` junto con la URL o se infiere del `pathname` de la URL de origen

### Enlace "Ver en biblioteca" desde Timeline
- [ ] El header de período sticky en `TimelineClient.tsx` incluye un enlace discreto "Ver en biblioteca →"
- [ ] El enlace navega a `/library?year=X` (o `?year=X&event=Y` si el período es un evento específico)
- [ ] El enlace tiene estilo secundario (no prominente) para no competir con el contenido visual de las fotos
- [ ] El enlace es accesible (es un `<a>` real con `href`, no un `<button>` con `onClick`)

---

## API necesaria

No requiere endpoints nuevos. La lógica es enteramente en el cliente con `sessionStorage`.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/library/[photoId]/PhotoDetailClient.tsx` | Leer `photoshelf_detail_origin` de `sessionStorage`; actualizar label y href del botón "atrás" |
| `src/app/timeline/TimelineClient.tsx` | Añadir enlace "Ver en biblioteca →" en `timeline-period-header` |
| Hook `useDetailOrigin` (nuevo, opcional) | Extraer la lógica de `sessionStorage` a un hook reutilizable |

---

## Notas técnicas

- El guardado en `sessionStorage` debe hacerse justo antes de navegar al detalle, p.ej. en el `onClick` del thumbnail en `PhotoGrid.tsx` y `TimelineClient.tsx`
- `sessionStorage` es por pestaña, por lo que no interfiere si el usuario tiene varias ventanas abiertas
- La clave `photoshelf_detail_origin` podría almacenar un objeto: `{ href: string, label: string }`
- El enlace "Ver en biblioteca" de la Timeline debe construir la URL con los filtros del período activo: para período "año" usar `?year=X`; para período "mes" usar `?year=X&month=M` si la biblioteca lo soporta

---

## Fuera de alcance (v1)

- Restauración de la posición de scroll en la biblioteca al volver desde el detalle
- Historial de navegación completo (breadcrumb multi-nivel)
- Soporte de gestos de deslizamiento lateral para volver (nativo de iOS Safari)
