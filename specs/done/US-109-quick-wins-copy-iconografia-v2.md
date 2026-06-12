# Feature: Quick wins de copy e iconografía — segunda pasada

## Historia de usuario

Como usuario de photoshelf,
quiero textos coherentes y un sistema de iconos uniforme en toda la app,
para percibir un producto cuidado y entender cada control sin ambigüedad.

---

## Descripción

Segunda tanda de quick wins de copy e iconografía (la primera fue US-039), derivada del UX audit del 2026-06-12:

**Copy**: la marca aparece como «PhotoShelf» en el login y «photoshelf» en el header; el estado vacío de la biblioteca menciona «tu NAS» cuando la app soporta cualquier carpeta; el botón de limpiar filtros dice «✕ 2 activos» sin verbo; el hint del login expone detalles de implementación («.env»).

**Iconografía**: conviven emojis y SVG (📂 y 🗂️ en resultados de búsqueda, 🖼 como foto rota en timeline, «···» textual como menú); al menos 8 SVG inline duplicados que deberían vivir en `Icons.tsx` (play repetido 4 veces, logout, info, bombilla IA, rescan); `IconCalendar` significa dos cosas distintas (recuerdos y cola de trabajos).

---

## Criterios de aceptación

### Copy
- [ ] Marca unificada a «photoshelf» (minúsculas) en login y cualquier otra superficie
- [ ] Estado vacío: «…las fotos de tu carpeta de biblioteca…» (sin asumir NAS)
- [ ] Botón limpiar filtros: «Limpiar (N)» o equivalente con verbo
- [ ] Hint del login eliminado o reescrito sin jerga («La contraseña se define en la configuración del servidor»)

### Iconografía
- [ ] Cero emojis con función de icono: 📂→`IconSmartAlbum`, 🗂️→`IconFolder`, 🖼→SVG de imagen rota, «···»→`IconDots`
- [ ] Nuevos iconos en `Icons.tsx`: `IconPlay`, `IconLogout`, `IconInfo`, `IconDots`, `IconBrokenImage` (+ los inline existentes migrados)
- [ ] El triángulo de play usa `IconPlay` en sus 4 ubicaciones (FilterBar, PhotoDetailClient ×2, Slideshow)
- [ ] La cola de trabajos usa un icono distinto a `IconCalendar` (reloj o lista)

### Verificación
- [ ] Grep sin matches de emojis funcionales en `src/`
- [ ] Las 5 vistas principales revisadas visualmente tras el cambio

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/Icons.tsx` | Nuevos iconos centralizados |
| `src/app/login/page.tsx` | Marca + hint |
| `src/components/PhotoGrid.tsx` | EmptyState copy + IconDots |
| `src/components/FilterBar.tsx` | Label limpiar + IconPlay |
| `src/app/search/SearchClient.tsx` | Emojis → SVG |
| `src/app/timeline/TimelineClient.tsx` | Foto rota SVG |
| `src/components/Sidebar.tsx` | SVGs inline → Icons.tsx + icono de jobs |

---

## Notas técnicas

- Cambios puramente presentacionales — sin tocar lógica ni API. Ideal como PR único revisable visualmente.
- Mantener el tamaño/grosor de trazo del set existente (strokeWidth 2, viewBox 24).

---

## Fuera de alcance (v1)

- Rediseño del set de iconos completo
- Traducción/i18n

> Estado: ✅ Desplegada
