# Feature: Selector de catálogo en el timeline

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009a](US-009a-migracion-catalogs-bd.md) + [US-009b](US-009b-api-crud-catalogos.md)

---

## Historia de usuario

Como fotógrafo con múltiples catálogos conectados,
quiero poder elegir qué catálogo (o todos a la vez) ver en la línea de tiempo,
para explorar mis fotos del móvil, mi biblioteca principal o ambas juntas
sin tener que cambiar de vista.

---

## Descripción

La topbar del timeline (`TimelineClient.tsx`) incluye hoy los controles de zoom temporal
(Año/Mes/Día) y el zoom visual (XS→XL). Esta historia añade un **selector de catálogo** como
un grupo de pills/chips en la topbar, entre el título sticky y los controles de zoom.

Cuando solo existe el catálogo por defecto, el selector **no se renderiza** — la topbar queda
exactamente igual que hoy. El selector aparece automáticamente en cuanto hay ≥ 2 catálogos
registrados.

La selección del catálogo activo se persiste en `sessionStorage` (igual que el nivel de zoom
y el zoom visual) y se propaga como parámetro `catalogId` a la API `/api/timeline`.

---

## Criterios de aceptación

### Selector en la topbar

- [ ] Si solo existe 1 catálogo, el selector no se renderiza (topbar idéntica al estado actual)
- [ ] Con ≥ 2 catálogos, aparece un grupo de pills en la topbar con: un pill "Todos" y un pill
  por cada catálogo registrado, con su color identificativo como punto o borde
- [ ] El pill activo queda visualmente resaltado (mismo estilo que los level-buttons activos del timeline)
- [ ] El selector es scrollable horizontalmente en mobile si hay muchos catálogos
- [ ] Al seleccionar un pill, el timeline resetea la paginación (limpia `allPhotos`, `nextCursor`,
  `hasMore`) y carga la primera página del catálogo seleccionado

### Persistencia

- [ ] La selección activa se guarda en `sessionStorage` bajo la clave `timeline_catalog`
  (valor: `'all'` o el `id` del catálogo como string)
- [ ] Al recargar la página, la selección se restaura desde `sessionStorage`
- [ ] Si el catálogo almacenado ya no existe (fue eliminado), se hace fallback silencioso a `'all'`

### API `/api/timeline` modificada

- [ ] Acepta el parámetro opcional `catalogId` (query param)
- [ ] Si `catalogId` está ausente o es `'all'`, devuelve fotos de todos los catálogos
  (comportamiento actual, sin cambios en la query)
- [ ] Si `catalogId` es un entero válido, añade `WHERE p.catalog_id = ?` a la query
- [ ] El cursor de paginación sigue siendo por `taken_at` — funciona igual con o sin filtro de catálogo

### Indicador visual de catálogo en la cuadrícula

- [ ] En la vista "Todos los catálogos", cada foto muestra un punto de color del catálogo al que
  pertenece en la esquina inferior derecha de la miniatura, visible en hover (no intrusivo)
- [ ] En vista de catálogo individual, el indicador no se muestra (innecesario)

---

## Cambios de código

### `src/app/timeline/page.tsx` — pasar catálogos como prop

```typescript
// Server component — añadir carga de catálogos
import { getCatalogs } from '@/lib/db';

export default async function TimelinePage() {
  // …
  const catalogs = getCatalogs(db);
  return <TimelineClient … catalogs={catalogs} />;
}
```

### `src/app/timeline/TimelineClient.tsx` — selector de catálogo

```typescript
// Nuevo estado
const [activeCatalog, setActiveCatalog] = useState<number | 'all'>(() => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('timeline_catalog');
    if (stored === 'all') return 'all';
    const n = parseInt(stored ?? '');
    if (!isNaN(n) && catalogs.some(c => c.id === n)) return n;
  }
  return 'all';
});

// Persistencia
useEffect(() => {
  try { sessionStorage.setItem('timeline_catalog', String(activeCatalog)); } catch {}
}, [activeCatalog]);

// Reset paginación al cambiar catálogo
function handleCatalogChange(catalog: number | 'all') {
  setActiveCatalog(catalog);
  setAllPhotos([]);
  setNextCursor(null);
  setHasMore(true);
}

// Pasar catalogId al fetch
const params = new URLSearchParams({ level, limit: String(limit) });
if (nextCursor) params.set('cursor', nextCursor);
if (activeCatalog !== 'all') params.set('catalogId', String(activeCatalog));
```

### `src/app/api/timeline/route.ts` — filtro por catálogo

```typescript
// Añadir parámetro catalogId
const catalogIdParam = sp.get('catalogId');
const catalogId = catalogIdParam && catalogIdParam !== 'all'
  ? parseInt(catalogIdParam, 10)
  : null;

// Modificar queries para incluir WHERE opcional
const catalogFilter = catalogId !== null ? 'AND p.catalog_id = ?' : '';
const queryArgs = catalogId !== null
  ? (cursor ? [cursor, catalogId, limit + 1] : [catalogId, limit + 1])
  : (cursor ? [cursor, limit + 1] : [limit + 1]);

// Alias de tabla: photos → p (para el WHERE dinámico)
rows = db.prepare(`
  SELECT p.id, p.filename, p.taken_at
  FROM photos p
  WHERE (p.taken_at IS NULL OR p.taken_at < ?) ${catalogFilter}
  ORDER BY p.taken_at DESC NULLS LAST, p.created_at DESC
  LIMIT ?
`).all(...queryArgs) as PhotoRow[];
```

---

## Notas técnicas

### Comportamiento de reset de paginación

Al cambiar de catálogo hay que limpiar `allPhotos` y `nextCursor` completamente antes del
siguiente `fetchMore`. El patrón actual de `setAllPhotos(prev => [...prev, ...incoming])`
concatena — si no se limpia, las fotos del catálogo anterior permanecen visibles hasta que
el scroll infinito las desplaza.

La forma más limpia es un `useEffect` sobre `activeCatalog` que ejecute el reset:

```typescript
useEffect(() => {
  setAllPhotos([]);
  setNextCursor(null);
  setHasMore(true);
}, [activeCatalog]);
```

### Selector invisible con un solo catálogo

```tsx
{catalogs.length > 1 && (
  <div className="timeline-catalog-pills">
    <button
      className={`timeline-catalog-pill${activeCatalog === 'all' ? ' active' : ''}`}
      onClick={() => handleCatalogChange('all')}
    >
      Todos
    </button>
    {catalogs.map(c => (
      <button
        key={c.id}
        className={`timeline-catalog-pill${activeCatalog === c.id ? ' active' : ''}`}
        onClick={() => handleCatalogChange(c.id)}
        style={{ '--catalog-color': c.color } as React.CSSProperties}
      >
        <span className="catalog-dot" />
        {c.name}
      </button>
    ))}
  </div>
)}
```

---

## Estrategia de coexistencia

Con un único catálogo, el selector no se renderiza y la topbar es pixel-perfect igual a hoy.
La query de timeline sin `catalogId` es idéntica a la actual. No hay ningún riesgo de regresión
hasta que el usuario añada un segundo catálogo (requiere US-009g).

Esta historia se puede desplegar antes de US-009g y testearse manualmente insertando un
catálogo directamente en SQLite o via `POST /api/catalogs`.

---

## Fuera de alcance

- Filtrado combinado catálogo + tag o catálogo + tema en el timeline
- Guardar la preferencia de catálogo entre sesiones (sessionStorage solo persiste en la pestaña)
- Animación de transición al cambiar de catálogo
