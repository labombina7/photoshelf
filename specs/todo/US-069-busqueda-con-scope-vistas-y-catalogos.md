# US-069 — Búsqueda con scope: vistas y catálogos

## Resumen

El buscador actual es global: devuelve resultados de toda la biblioteca sin tener en cuenta en qué vista o catálogo está el usuario. Esta historia añade un **selector de scope** al buscador para que el usuario pueda acotar la búsqueda a:

- **El catálogo activo** (ya existe el parámetro `catalog` en `/api/search`, pero no está expuesto en la UI)
- **Una vista concreta**: temática (smart folder), álbum inteligente, proyecto/portfolio, o cualquier otra vista activa
- **Toda la biblioteca** (comportamiento actual, opción por defecto)

---

## Problema

Cuando el usuario está navegando dentro de un álbum "Verano 2023" o una temática "Retratos" y lanza una búsqueda, los resultados llegan de toda la biblioteca. El usuario tiene que hacer el filtrado mental de qué resultado pertenece a qué contexto, y no puede responder preguntas como "¿hay fotos de atardecer en este álbum?" sin salir de la vista.

---

## Comportamiento esperado

### Selector de scope en el buscador

- La barra de búsqueda (header) muestra un **pill/chip** junto al campo de texto que indica el scope activo.
- Por defecto el scope es "Toda la biblioteca".
- Si el usuario está en una vista con contexto (temática, álbum, proyecto), el scope se pre-rellena automáticamente con esa vista.
- El usuario puede cambiar el scope manualmente con un dropdown: las opciones son la vista activa (si aplica), "Catálogo actual", y "Toda la biblioteca".

### Comportamiento del scope por vista

| Vista actual | Scope pre-seleccionado | Filtros que se aplican |
|---|---|---|
| Biblioteca general | Toda la biblioteca | ninguno extra |
| Temática X | "En: Temática X" | `theme={id}` |
| Álbum inteligente Y | "En: Álbum Y" | las reglas del álbum |
| Proyecto Z | "En: Proyecto Z" | `project={id}` |
| Favoritos | "En: Favoritos" | `favorite=1` |
| Sin etiquetar | "En: Sin etiquetar" | `untagged=1` |
| Vista con catálogo N activo | "Catálogo: N" | `catalog=N` |

### Resultados

- Los resultados de búsqueda muestran el scope activo como contexto ("Resultados para 'atardecer' en Temática Retratos").
- Si el scope no devuelve resultados, se muestra opción de ampliar a "Toda la biblioteca".
- Las estrategias de búsqueda existentes (año, tag, evento, fulltext, AI) funcionan igual, pero filtradas al scope.

---

## Criterios de aceptación

- [ ] El campo de búsqueda muestra un indicador visual del scope activo cuando no es "Toda la biblioteca"
- [ ] Navegar a una temática y buscar desde ahí limita los resultados a fotos de esa temática
- [ ] Navegar a un álbum inteligente y buscar limita los resultados a fotos de ese álbum
- [ ] Navegar a un proyecto y buscar limita los resultados a fotos de ese proyecto
- [ ] El scope "Catálogo actual" filtra por el `catalog_id` activo en la sesión
- [ ] Cambiar el scope desde el dropdown relanza la búsqueda con el nuevo scope
- [ ] Si la búsqueda con scope no da resultados, aparece CTA "Buscar en toda la biblioteca"
- [ ] La URL de resultados refleja el scope (p.ej. `?q=atardecer&scope=theme&scope_id=3`) para que sea compartible
- [ ] La búsqueda AI (Ollama) también respeta el scope (candidatos pre-filtrados antes de embedding)

---

## Diseño técnico

### API: `/api/search`

Añadir parámetros opcionales:

```
GET /api/search?q=...&scope_type=theme&scope_id=3
GET /api/search?q=...&scope_type=album&scope_id=12
GET /api/search?q=...&scope_type=project&scope_id=7
GET /api/search?q=...&scope_type=catalog&catalog=2
GET /api/search?q=...&scope_type=favorite
GET /api/search?q=...&scope_type=untagged
```

- `scope_type`: `library` (default) | `theme` | `album` | `project` | `catalog` | `favorite` | `untagged`
- `scope_id`: ID de la entidad cuando aplica

### `src/lib/search/execute.ts`

Recibir un objeto `SearchScope` y pasarlo como filtro adicional a cada estrategia:

```typescript
type SearchScope =
  | { type: 'library' }
  | { type: 'favorite' }
  | { type: 'untagged' }
  | { type: 'theme'; id: number }
  | { type: 'album'; id: number }
  | { type: 'project'; id: number }
  | { type: 'catalog'; catalogId: number };
```

- Para `theme`, `album`, `project`: hacer JOIN con las tablas existentes o aplicar subquery sobre los IDs de fotos que pertenecen a esa entidad, y añadir `AND p.id IN (...)` al SQL de cada estrategia.
- Para `catalog`: añadir `AND p.catalog_id = :catalogId`.
- Para AI: pre-filtrar los candidatos antes de mandarlos a Ollama, para no desperdiciar tokens/tiempo en fotos fuera del scope.

### `src/app/search/SearchClient.tsx`

- Leer `scope_type` y `scope_id` de los search params.
- Mostrar badge con el scope en el header de resultados.
- Renderizar CTA "Ampliar a toda la biblioteca" cuando `total === 0`.

### `src/components/SearchBar.tsx` (o similar)

- Añadir dropdown de scope junto al input.
- Detectar automáticamente el scope de la página actual pasándolo como prop desde cada layout/page.
- Emitir el scope en la URL al navegar a `/search`.

### Propagación del scope desde las páginas

Cada página que quiera pre-configurar el scope debe pasar la información al componente de búsqueda global. La forma más limpia es un contexto React (`SearchScopeContext`) que cada page/layout actualiza al montarse.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/app/api/search/route.ts` | Parsear `scope_type` y `scope_id` y pasarlos a `executeSearch()` |
| `src/lib/search/execute.ts` | Aceptar `SearchScope` y aplicarlo como filtro extra en cada estrategia |
| `src/lib/search/classifier.ts` | Sin cambios (la clasificación es independiente del scope) |
| `src/lib/queries/search.ts` | Añadir helper `buildScopeFilter(scope)` que devuelve cláusula SQL + params |
| `src/app/search/page.tsx` | Leer scope params y pasarlos al SearchClient |
| `src/app/search/SearchClient.tsx` | Mostrar badge de scope y CTA de fallback |
| `src/components/Sidebar.tsx` (o layout) | Exponer scope context al header de búsqueda |
| `src/lib/types.ts` | Añadir tipo `SearchScope` |

---

## Notas de implementación

- Los álbumes inteligentes tienen reglas dinámicas (`src/app/smart-albums/`). Para el scope de álbum, ejecutar primero la query del álbum para obtener los `photo_id`s, luego usarlos como subconjunto para la búsqueda. Si el álbum tiene muchas fotos (>5000), usar subquery en lugar de `IN (...)`.
- No romper el comportamiento actual: si no se pasa scope, la búsqueda funciona exactamente igual que hoy.
- La estrategia AI con scope reduce el corpus antes de vectorizar → mejora de rendimiento en bibliotecas grandes.

---

## Estimación

**Talla: M** — 3–4 sesiones de trabajo.

- Backend (execute + queries): 1 sesión
- API route: 0,5 sesiones
- UI scope picker + contexto: 1,5 sesiones
- Tests y edge cases (álbum vacío, scope sin resultados): 0,5 sesiones
