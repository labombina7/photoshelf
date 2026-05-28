# US-031: Página de resultados `/search` en el área principal

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** M
> **Dependencias:** US-028, US-030

---

## Historia

**Como** usuario de photoshelf,  
**quiero** ver los resultados de búsqueda en el área principal de la app,  
**para** poder explorarlos con comodidad, usar el botón atrás y compartir la URL de mis resultados.

---

## Contexto

Actualmente los resultados de la búsqueda IA aparecen en un panel deslizante (`AISearchPanel`) que cubre parte de la pantalla. Esto impide ver los resultados a pantalla completa, no genera una URL navegable y queda por encima del contenido principal.

Esta US crea la página `/search` que recibe la query por URL, llama a `/api/search` y muestra los resultados como vista de primera clase dentro del layout normal de la app (con sidebar y header).

---

## Criterios de aceptación

### Ruta y URL

- [ ] La página existe en `src/app/search/page.tsx`
- [ ] La URL sigue el patrón `/search?q={query}` — la query viene del parámetro `q`
- [ ] El campo de búsqueda del header muestra la query activa cuando se está en `/search`
- [ ] Cambiar la query en el header y pulsar Enter actualiza la URL y recarga los resultados (sin recargar la página completa — `router.push`)

### Layout de resultados

- [ ] La página muestra un encabezado con la query buscada y el número de resultados: `Resultados para "boda" — 42 fotos`
- [ ] Los resultados se organizan en secciones cuando hay más de un tipo:
  - **Fotos** (grid de miniaturas, mismo estilo que `/library`)
  - **Tags** (chips clicables que llevan a `/tags/{tag}`)
  - **Eventos** (lista con año y número de fotos)
- [ ] Si solo hay resultados de un tipo, se muestra directamente sin encabezado de sección
- [ ] Cada foto del grid es clicable y abre el detalle (`/library/{id}`)
- [ ] El grid de fotos usa el mismo componente `PhotoGrid` existente

### Estado de carga

- [ ] Mientras la búsqueda está en curso, se muestra un skeleton/spinner en el área de resultados
- [ ] El header muestra la barra con un indicador de carga (spinner en el icono de lupa)

### Estado vacío

- [ ] Si no hay resultados, se muestra un mensaje claro: `No encontramos nada para "xyz"` con sugerencias: "Prueba con menos palabras" o "¿Quieres buscar con IA?"
- [ ] El estado vacío tiene un botón que fuerza la búsqueda en modo IA (`/search?q=xyz&mode=ai`) si el intent original no era `ai`

### Accesibilidad

- [ ] El título de la página (`<title>`) incluye la query: `"boda" — Búsqueda — photoshelf`
- [ ] El área de resultados tiene `role="main"` y `aria-label="Resultados de búsqueda"`
- [ ] Los resultados vacíos tienen `aria-live="polite"` para lectors de pantalla

---

## Notas técnicas

- La página es un Server Component que lee `searchParams.q` y hace la llamada a `/api/search` en el servidor (SSR), sin hook de cliente para la carga inicial
- Para las actualizaciones de query (cuando el usuario cambia la búsqueda desde el header), el componente cliente `SearchPageClient` gestiona el estado local y hace fetch al endpoint
- El grid de fotos puede reutilizar `PhotoGrid` pero sin las acciones de bulk (favorito, tags) que no aplican en resultados de búsqueda
- La URL `/search` sin parámetro `q` redirige a `/library`

---

## Fuera de alcance

- Filtros en la página de resultados (por año, tag, etc.) — v2
- Paginación de resultados — v1 muestra hasta 200
- Ordenación de resultados — v1 usa el orden devuelto por la API
- Guardar búsquedas como temáticas — se mantiene en US-032 solo para resultados IA
