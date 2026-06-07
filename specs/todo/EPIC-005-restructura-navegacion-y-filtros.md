# Épica: Reestructura de navegación y filtros

> **Estado: 🗂 Planificada**

---

## Visión general

La UI de photoshelf ha crecido orgánicamente y la sidebar carga con demasiadas responsabilidades: navegación global de módulos, filtros de catálogo, filtros técnicos EXIF y gestión editorial de temáticas. El resultado es una interfaz donde todo comparte el mismo nivel jerárquico, sin señalar qué es navegación de app y qué es exploración de catálogo.

Esta épica introduce una **arquitectura de navegación en tres capas** con responsabilidades claras:

1. **Nav global en el header** — módulos independientes con identidad propia: Proyectos y Álbumes. Son entidades, no formas de ver el catálogo.
2. **Sidebar** — exploración del catálogo: vistas (Todas, Timeline, Favoritos, Sin clasificar, Tags) y clasificación editorial (Temáticas). Todo lo que es "filtrar o explorar mis fotos".
3. **Filter bar** — franja horizontal sticky bajo el header, visible solo en vistas de catálogo. Concentra todos los filtros de corte: año, cámara, ISO, apertura, focal.

---

## Problema que resuelve

El usuario no tiene clara la distinción entre "estoy navegando entre módulos de la app" y "estoy filtrando qué fotos veo". La sidebar mezcla ambas cosas. Los filtros EXIF están escondidos bajo un acordeón "Técnico" que requiere dos clics para activarlos. Los chips de año flotan en el catálogo sin relación visual con el resto de filtros. Proyectos y Álbumes comparten espacio con Favoritos y Sin clasificar como si fueran del mismo tipo.

---

## Arquitectura resultante

```
┌─────────────────────────────────────────────────────────────────┐
│  photoshelf   [Proyectos · Álbumes]              [⌘K Buscar]   │  NAV GLOBAL
├──────────┬──────────────────────────────────────────────────────┤
│          │  [2024] [2023] [2022]  Cámara ▾  ISO ▾  Apertura ▾  │  FILTER BAR (solo catálogo)
│ SIDEBAR  ├──────────────────────────────────────────────────────┤
│          │                                                      │
│ Todas    │                                                      │
│ Timeline │            CONTENT AREA                              │
│ Favoritos│                                                      │
│ Sin clas.│                                                      │
│ Tags     │                                                      │
│ ──────── │                                                      │
│ Temáticas│                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### Por qué Proyectos y Álbumes van al nav global y Temáticas no

**Proyectos**: entidad con identidad propia — título, fechas, fotos seleccionadas, narrativa de trabajo. El usuario "va a" un proyecto a hacer algo.

**Álbumes** (smart albums): curaduría con reglas y portada propia. También son entidades.

**Temáticas**: etiquetas editoriales que filtran el catálogo. Semánticamente idénticas a Favoritos — son el catálogo con un lens puesto. El usuario no "va a" Temáticas, filtra el catálogo *por* una temática. Su lugar natural es el sidebar, junto a Favoritos y Tags.

---

## Historias de usuario

### US-078 — Nav global en el header (Proyectos · Álbumes)

Añadir una zona de navegación de módulos en `AppHeader`, entre el logo y el buscador.

**Criterios:**
- Dos tabs: Proyectos (`/projects`) y Álbumes (`/smart-albums`)
- Tab activo marcado con subrayado usando `var(--tag-auto-color)`
- Al navegar entre módulos, el tab activo se actualiza correctamente
- En móvil: los tabs se colapsan junto al menú hamburguesa o en scroll horizontal
- El slot izquierdo del header (`slotLeft`) sigue funcionando para contenido contextual de cada vista

**Componentes afectados:** `AppHeader.tsx`

---

### US-079 — Sidebar simplificada (solo catálogo y temáticas)

Limpiar la sidebar eliminando los elementos de navegación global que pasan al header.

**Criterios:**
- **Se elimina** de la sidebar: ningún link de navegación pasa al nav global en esta US — Proyectos y Álbumes ya no tendrán sección propia en la sidebar
- **Se mantiene** en la sidebar: Todas las fotos, Timeline, Mapa, Memorias, Favoritos, Sin clasificar, Tags
- **Se mantiene** en la sidebar: sección Temáticas con su gestión inline (crear, editar, borrar, color)
- **Se elimina** de la sidebar: `ExifFilters` (pasa al filter bar en US-080)
- La sidebar no muestra los filtros EXIF en ningún estado — su única responsabilidad es navegación y temáticas
- Los tests de smoke deben pasar: todas las rutas existentes siguen funcionando

**Componentes afectados:** `Sidebar.tsx`, `ExifFilters.tsx` (se extrae del sidebar)

---

### US-080 — Filter bar horizontal con chips de año y filtros EXIF

Nueva franja de filtros horizontal, sticky bajo el header, visible únicamente en vistas de catálogo (`/library` y sus variantes).

**Estructura:**

```
[2024] [2023] [2022] [2021] [+N más]  |  Cámara ▾  |  ISO ▾  |  Apertura ▾  |  Focal ▾  |  ✕ 3 activos
```

**Criterios:**

*Chips de año:*
- Se muestran los años disponibles en el catálogo activo, ordenados de más reciente a más antiguo
- Si hay más de 5 años, se trunca con `+N más` que expande/colapsa
- Año activo: estilo activo consistente con el resto de la app (`var(--tag-auto-color)`)
- Los chips de año desaparecen de `LibraryClient` y se centralizan aquí

*Filtros EXIF (dropdowns):*
- Cámara: selector con las cámaras del catálogo activo
- ISO: opciones ≤400, ≤1600, ≤6400
- Apertura: opciones ≤f/2, ≤f/2.8, ≤f/4, ≤f/8
- Focal: rango mín/máx (se muestra solo si el catálogo tiene datos de focal)
- Botón activo (con valor seleccionado): fondo `var(--tag-auto-bg)`, texto y borde `var(--tag-auto-color)`
- Botón inactivo: borde `var(--border)`, texto `var(--text-secondary)`

*Gestión de filtros activos:*
- Aparece un pill `✕ N activos` cuando hay al menos un filtro activo
- Clic en el pill limpia todos los filtros activos de golpe
- Los filtros se propagan a la URL (`/library?iso_max=1600&camera=Sony+A7`) para que sean compartibles y navegables con el botón atrás

*Visibilidad condicional:*
- La filter bar aparece solo en rutas de catálogo: `/library` y sus variantes con params
- En `/projects`, `/smart-albums`, `/timeline`, `/map` etc., la filter bar no se renderiza
- La transición de aparición/desaparición debe ser suave (no un pop abrupto)

**Componentes nuevos/afectados:** `FilterBar.tsx` (nuevo), `LibraryClient.tsx` (delega chips de año), `ExifFilters.tsx` (refactorizado a horizontal)

---

### US-081 — Ajustes responsive y mobile

Adaptar los tres niveles de la nueva arquitectura para pantallas pequeñas.

**Criterios:**

*Nav global (móvil):*
- Los tabs Proyectos y Álbumes se integran con el menú hamburguesa existente, o se muestran en scroll horizontal bajo el logo
- No deben solapar el buscador en pantallas < 640px

*Filter bar (móvil):*
- Scroll horizontal en el rail completo — se desliza en X sin wrap
- Los dropdowns de filtros EXIF abren un bottom sheet en móvil en lugar de un dropdown hacia abajo
- El pill `✕ N activos` siempre visible al final del rail

*Sidebar (móvil):*
- Sin cambios en el patrón de apertura/cierre — sigue siendo overlay lateral con swipe para cerrar
- Al simplificarla (sin EXIF), el scroll interno es más corto y cómodo

---

## Decisiones de diseño tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Temáticas en sidebar | Temáticas en nav global | Son filtros del catálogo, no entidades independientes — semánticamente igual que Favoritos |
| Proyectos + Álbumes en nav global | Proyectos + Álbumes en sidebar | Son entidades con identidad propia, no formas de ver el catálogo |
| Filter bar solo en vistas de catálogo | Filter bar siempre visible | Los filtros no tienen sentido en Proyectos o Álbumes — aparecerla siempre confundiría |
| Dropdowns en filter bar (no accordion) | Mantener accordion "Técnico" del sidebar | Los filtros EXIF deben ser accesibles en un clic, no en dos |

---

## Orden de implementación recomendado

1. **US-079** primero — simplificar el sidebar es la base. Requiere extraer `ExifFilters` del sidebar sin romper la funcionalidad.
2. **US-078** segundo — añadir el nav global al header. Independiente del sidebar.
3. **US-080** tercero — construir el filter bar con los años y los EXIF ya extraídos.
4. **US-081** último — ajustes responsive una vez los tres niveles están en su sitio.

---

## Archivos clave

| Archivo | Rol en la épica |
|---|---|
| `src/components/AppHeader.tsx` | Recibe el nav global de módulos |
| `src/components/Sidebar.tsx` | Se simplifica: pierde ExifFilters y los módulos pasan al header |
| `src/components/ExifFilters.tsx` | Se refactoriza de vertical (acordeón) a horizontal (dropdowns) |
| `src/app/library/LibraryClient.tsx` | Delega chips de año al FilterBar |
| `src/components/FilterBar.tsx` | Nuevo — concentra años + EXIF en rail horizontal |
