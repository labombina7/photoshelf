# US-034: Retirar AISearchPanel y botón Buscar del sidebar

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** S
> **Dependencias:** US-031, US-032

---

## Historia

**Como** mantenedor del código,  
**quiero** eliminar el `AISearchPanel` y el botón "Buscar" del sidebar una vez que la búsqueda unificada esté operativa,  
**para** reducir la deuda técnica y evitar que el usuario tenga dos puntos de entrada de búsqueda distintos.

---

## Contexto

Cuando US-031 y US-032 estén desplegadas, toda la funcionalidad de `AISearchPanel` estará integrada en la barra del header y la página `/search`. Este componente y su botón de activación en el sidebar deben eliminarse limpiamente.

Esta US se ejecuta **después** de validar que la búsqueda unificada cubre todos los casos de uso del panel antiguo.

---

## Criterios de aceptación

### Eliminación de componentes

- [ ] Se elimina el archivo `src/components/AISearchPanel.tsx`
- [ ] Se elimina el botón `ai-search-trigger` del sidebar (`src/components/Sidebar.tsx`)
- [ ] Se eliminan todas las referencias a `AISearchPanel` e `IconSparkle` (si ya no se usa en otros sitios)
- [ ] Se eliminan los estilos CSS asociados al panel: clases `.ai-panel`, `.ai-panel-overlay`, `.ai-panel-header`, `.ai-panel-body`, `.ai-panel-close`, `.ai-search-input`, `.ai-mode-toggle`, `.ai-mode-btn`, `.ai-mode-hint`, `.ai-search-btn`, `.ai-results`, `.ai-results-meta`, `.ai-progress`, `.ai-progress-bar`, `.ai-progress-fill`, `.ai-photo-grid`, `.ai-photo-thumb`, `.ai-save-theme`, `.ai-search-trigger`

### Verificación

- [ ] `npm run build` completa sin errores ni warnings de imports no usados
- [ ] La búsqueda desde el header cubre todos los casos que antes manejaba el panel:
  - Búsqueda por tags (modo quick) ✓
  - Búsqueda por concepto con IA ✓
  - Modo deep (análisis visual) ✓
  - Guardar como temática ✓
- [ ] El sidebar no tiene espacio vacío ni elementos descuadrados tras la eliminación del botón

### Migración de endpoint

- [ ] El endpoint `/api/ai/search` se mantiene temporalmente (puede ser usado por el `mode=deep` de US-032) — no eliminarlo en esta US
- [ ] Añadir un comentario en `/api/ai/search/route.ts` indicando que es un endpoint legado usado solo por el modo deep

---

## Checklist de archivos afectados

| Archivo | Acción |
|---|---|
| `src/components/AISearchPanel.tsx` | Eliminar |
| `src/components/Sidebar.tsx` | Quitar import + botón trigger |
| `src/app/globals.css` | Eliminar clases `.ai-*` y `.ai-search-trigger` |
| `src/components/Icons.tsx` | Verificar si `IconSparkle` se usa en otros sitios; si no, eliminar |

---

## Notas técnicas

- Hacer esta US en un PR separado y pequeño para que el diff sea fácil de revisar
- Ejecutar el linter después de la eliminación: `npm run lint`
- No eliminar el endpoint `/api/ai/search` todavía — puede reutilizarse para el modo deep
