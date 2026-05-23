# Feature: Sidebar con árbol de navegación por catálogo

> **Épica:** [EPIC-001 — Múltiples catálogos](EPIC-001-multiples-catalogos.md)
> **Estado: ⬜ Pendiente**
> **Dependencias:** [US-009a](US-009a-migracion-catalogs-bd.md) + [US-009b](US-009b-api-crud-catalogos.md)

---

## Historia de usuario

Como fotógrafo con múltiples catálogos conectados,
quiero ver cada catálogo como una sección independiente en el sidebar con su propio árbol de navegación,
para acceder directamente a años, eventos o a "todas las fotos" de cada fuente sin mezclar nada.

---

## Descripción

El sidebar actual tiene una sección fija "Biblioteca" con los accesos globales (Todas las fotos,
Línea de tiempo, Favoritos, etc.). Con múltiples catálogos, esta sección se convierte en una lista
de catálogos donde cada uno tiene su propio subárbol.

**Cuando solo existe el catálogo por defecto**, el sidebar se renderiza exactamente igual que hoy:
la sección "Biblioteca" con los mismos ítems, sin indicaciones de catálogo. El cambio es invisible
hasta que el usuario añade un segundo catálogo.

Con ≥ 2 catálogos, la sección "Biblioteca" se reemplaza por secciones colapsables individuales,
una por catálogo. Cada sección tiene su nombre, un punto de color y los ítems de navegación
propios de ese catálogo según su `scan_mode`.

---

## Criterios de aceptación

### Modo un solo catálogo (retrocompatibilidad)

- [ ] Con 1 catálogo, el sidebar es idéntico al actual — misma sección "Biblioteca", mismos ítems,
  mismo orden

### Modo multi-catálogo (≥ 2 catálogos)

- [ ] La sección "Biblioteca" se sustituye por una sección colapsable por cada catálogo
- [ ] Cada sección muestra: punto de color del catálogo + nombre del catálogo + chevron de colapso
- [ ] El estado colapsado/expandido de cada catálogo se persiste en `sessionStorage` bajo la clave
  `sidebar_catalog_open_{id}`
- [ ] Por defecto, el catálogo 1 (principal) empieza expandido; los demás colapsados

### Árbol de navegación por catálogo — modo `structured`

- [ ] Dentro de la sección del catálogo aparecen: "Todas las fotos (N)", "Favoritos"
- [ ] Debajo, un ítem colapsable "Por año" que lista los años disponibles en ese catálogo
  (query: `SELECT DISTINCT year FROM photos WHERE catalog_id = ? AND year > 0 ORDER BY year DESC`)
- [ ] Al expandir un año, se listan sus eventos (query: `SELECT DISTINCT event FROM photos WHERE catalog_id = ? AND year = ? ORDER BY event ASC`)
- [ ] Los ítems de año y evento funcionan como filtros de navegación hacia `/library?catalog={id}&year={y}` y `/library?catalog={id}&year={y}&event={e}` (la vista de biblioteca deberá aceptar estos filtros — se deja para una historia separada si es necesario)

### Árbol de navegación por catálogo — modo `flat`

- [ ] Dentro de la sección del catálogo aparecen solo: "Todas las fotos (N)" y "Favoritos"
  (sin árbol de año/evento ya que la estructura no es predecible)

### Ítem activo

- [ ] El ítem activo en el sidebar refleja el catálogo y filtro actualmente aplicados en la vista
- [ ] Los ítems globales que existen hoy (Línea de tiempo, Tags, Temáticas, Portfolio, Estadísticas)
  se mantienen igual — no son específicos de ningún catálogo

---

## Cambios de código

### `src/components/Sidebar.tsx`

La lógica de renderizado de la sección "Biblioteca" se bifurca según `catalogs.length`:

```tsx
// Props actualizadas
interface SidebarProps {
  // … las actuales …
  catalogs: CatalogWithCount[];  // nuevo
}

// Lógica de renderizado
{catalogs.length <= 1 ? (
  // Sección "Biblioteca" actual — sin cambios
  <div className="sidebar-section">
    <div className="sidebar-section-label">Biblioteca</div>
    {/* … ítems actuales … */}
  </div>
) : (
  // Multi-catálogo
  catalogs.map(catalog => (
    <CatalogSection
      key={catalog.id}
      catalog={catalog}
      pathname={pathname}
      searchParams={searchParams}
      onNavClick={handleNavClick}
    />
  ))
)}
```

### Nuevo subcomponente `CatalogSection`

```tsx
function CatalogSection({ catalog, pathname, searchParams, onNavClick }) {
  const storageKey = `sidebar_catalog_open_${catalog.id}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return catalog.id === 1;
    return sessionStorage.getItem(storageKey) !== 'false';
  });
  const [years, setYears] = useState<number[]>([]);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<number, string[]>>({});

  // Cargar años al expandir la sección
  useEffect(() => {
    if (!open || catalog.scan_mode !== 'structured') return;
    fetch(`/api/catalogs/${catalog.id}/years`)
      .then(r => r.json())
      .then(d => setYears(d.years));
  }, [open, catalog.id, catalog.scan_mode]);

  // … render del árbol …
}
```

### Nuevo endpoint `GET /api/catalogs/[id]/years`

```typescript
// Devuelve los años disponibles en un catálogo
export async function GET(_: NextRequest, { params }: ...) {
  const db = getDb();
  const years = db.prepare(`
    SELECT DISTINCT year FROM photos
    WHERE catalog_id = ? AND year > 0
    ORDER BY year DESC
  `).all(parseInt(params.id, 10)) as { year: number }[];
  return NextResponse.json({ years: years.map(r => r.year) });
}
```

---

## Notas técnicas

### Carga lazy del árbol de años/eventos

Los años y eventos de cada catálogo se cargan on-demand al expandir la sección, no en el
server component inicial. Esto evita N queries adicionales al arrancar la aplicación cuando
hay varios catálogos. La carga se hace con un `useEffect` que se dispara cuando `open` pasa
a `true`.

### Props hacia todos los layouts

Actualmente `Sidebar` recibe `totalPhotos`, `favoriteCount` y `untaggedCount` desde los
server components de cada página. Con multi-catálogo, estas cifras son globales (todos los
catálogos combinados) para el catálogo único; con múltiples catálogos, `totalPhotos` pasa a
ser la suma, y `favoriteCount` también. No hace falta desagregar por catálogo en esta historia.

### No modificar las rutas de `/library` todavía

Los enlaces `href="/library?catalog={id}&year={y}"` que genera esta historia son preparatorios.
La vista `/library` ignorará el parámetro `catalog` hasta que se implemente el filtrado
correspondiente (puede ir en una historia de seguimiento fuera de esta épica o como US-010).

---

## Estrategia de coexistencia

Con un único catálogo, el componente `Sidebar` renderiza exactamente el mismo HTML de hoy.
La prop `catalogs` se añade con valor por defecto vacío en las páginas que aún no la pasen,
y el componente trata `catalogs.length <= 1` como "modo legacy".

La transición es gradual: primero se despliega con `catalogs = [defaultCatalog]` y el sidebar
es idéntico. Solo cuando el usuario añade un segundo catálogo (US-009g) cambia la UI.

---

## Fuera de alcance

- Filtrado de la vista de biblioteca por catálogo + año + evento (follow-up independiente)
- Drag & drop para reordenar catálogos en el sidebar
- Icono personalizable por catálogo (solo se usa el punto de color)
- Buscador de catálogos en el sidebar (no es necesario con menos de ~10 catálogos)
