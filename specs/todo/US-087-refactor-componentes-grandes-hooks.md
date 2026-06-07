# Feature: Refactor de componentes grandes — hooks custom y dependencias de useEffect

## Historia de usuario

Como desarrollador de photoshelf,
quiero que los componentes de más de 300 líneas estén divididos en hooks y subcomponentes con responsabilidades claras,
para poder leer, testear y modificar cada parte sin entender el componente completo.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó tres componentes que superan las 300 líneas mezclando lógica de negocio, gestión de estado y presentación:

- `src/app/library/LibraryClient.tsx` (398 líneas)
- `src/components/DetailPanel.tsx` (396 líneas)
- `src/app/search/SearchClient.tsx` (367 líneas)

Además, `LibraryClient.tsx` contiene tres `eslint-disable-next-line react-hooks/exhaustive-deps` que suprimen advertencias reales. En particular, `openSlideshow` se usa dentro del `useEffect` del atajo de teclado `P` pero no está declarado como dependencia, capturando `activeFilters` del momento del mount en lugar de los valores actuales.

**Estrategia de refactor**:

- **`LibraryClient.tsx`**: extraer `useSlideshow(filters)` que encapsula `openSlideshow`, el `useEffect` de teclado y el estado `slideshowIds`. Con `useCallback` sobre `openSlideshow` la dependencia puede declararse explícitamente y eliminar el `eslint-disable`.
- **`DetailPanel.tsx`**: extraer `useTagEditor(photo)` con la lógica de añadir/eliminar tags y `useAiReview(photo)` con la lógica de clasificación y review de IA. El componente queda como orquestador de presentación.
- **`SearchClient.tsx`**: extraer `useThemeEditor()` con la lógica de crear/asignar temas y `useAiSearch(query)` con el estado de búsqueda IA.

---

## Criterios de aceptación

### LibraryClient.tsx
- [ ] El componente queda por debajo de 250 líneas tras el refactor
- [ ] Existe `src/hooks/useSlideshow.ts` con `openSlideshow`, el listener de teclado y el estado `slideshowIds`
- [ ] Los tres `eslint-disable react-hooks/exhaustive-deps` son eliminados
- [ ] `openSlideshow` usa `useCallback` con las dependencias correctas declaradas
- [ ] El slideshow sigue funcionando con todos los filtros activos

### DetailPanel.tsx
- [ ] El componente queda por debajo de 250 líneas
- [ ] Existe `src/hooks/useTagEditor.ts` con la lógica de gestión de tags (añadir, eliminar, guardar)
- [ ] Existe `src/hooks/useAiReview.ts` con la lógica de classify y review de IA
- [ ] La experiencia de usuario es idéntica a la actual

### SearchClient.tsx
- [ ] El componente queda por debajo de 250 líneas
- [ ] La lógica de temas y búsqueda IA está extraída en hooks dedicados
- [ ] La búsqueda IA sigue funcionando igual

### Calidad
- [ ] `npm run build` pasa sin errores de TypeScript
- [ ] `npm test` pasa sin regresiones

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/hooks/useSlideshow.ts` | Hook nuevo: estado y lógica del slideshow + atajo de teclado |
| `src/hooks/useTagEditor.ts` | Hook nuevo: gestión CRUD de tags de una foto |
| `src/hooks/useAiReview.ts` | Hook nuevo: classify y review de foto con Ollama |
| `src/app/library/LibraryClient.tsx` | Reducir a < 250 líneas, eliminar eslint-disables |
| `src/components/DetailPanel.tsx` | Reducir a < 250 líneas |
| `src/app/search/SearchClient.tsx` | Reducir a < 250 líneas |

---

## Notas técnicas

- El refactor es puro: no cambia endpoints, esquema de BD ni comportamiento visible
- Priorizar la eliminación de los `eslint-disable` primero — son el riesgo técnico más concreto (stale closure en `openSlideshow`)
- Los hooks extraídos son candidatos naturales a tener tests unitarios en una US posterior

---

## Fuera de alcance (v1)

- Tests unitarios de los hooks extraídos (se pueden añadir en una US de testing posterior)
- Refactor de otros componentes fuera de los tres identificados
- Migración a una librería de gestión de estado global
