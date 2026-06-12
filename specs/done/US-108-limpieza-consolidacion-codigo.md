# Feature: Limpieza y consolidación de código — dead code, tipos duplicados y hook de polling

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador de photoshelf,
quiero eliminar el código muerto y consolidar los patrones duplicados que señala el audit,
para que el mantenimiento sea más barato y los bugs no se arreglen en un sitio y persistan en otro.

---

## Descripción

Cajón de limpieza del tech debt audit del 2026-06-12 — hallazgos 🟢 individualmente pequeños pero que en conjunto suman fricción:

1. **Dead code**: `showToast` en `LibraryClient.tsx:116` nunca se invoca (estado + render del toast huérfanos); ficheros vacíos `photos.db` y `photoshelf.db` (0 bytes) en la raíz del repo confunden sobre dónde vive la BD real (`data/photoshelf.db`).
2. **Tipos duplicados**: `EventGroup` y `ActiveFilters` definidos dos veces (`LibraryClient.tsx:19-38` vs `PhotoGrid.tsx:31-49`) con campos casi idénticos; `import('@/lib/queries/catalogs').CatalogRow` inline en 6+ ficheros.
3. **Polling de jobs triplicado**: el patrón setInterval→fetch job→detectar terminal está copiado en `PhotoGrid.tsx:269-289`, `ProjectsClient.tsx:109-128` y `ClassifyProvider.tsx`, con bugs distintos en cada copia (cleanup inconsistente).
4. **Fuente externa**: Inter se carga de Google Fonts CDN (`layout.tsx:19-23`) — en una app self-hosted para LAN, filtra la IP a Google y falla sin internet.
5. **Magic numbers de gestos** (500 ms long-press, 300 ms double-tap, umbrales de swipe) dispersos sin constantes.

---

## Criterios de aceptación

### Dead code
- [ ] `showToast` eliminado o conectado a errores reales (decisión coordinada con US-099)
- [ ] `photos.db` y `photoshelf.db` de la raíz eliminados y patrón añadido a `.gitignore`

### Tipos consolidados
- [ ] `EventGroup`, `ActiveFilters` y re-export de `CatalogRow` viven en `src/lib/types.ts`
- [ ] Cero definiciones duplicadas (verificable con grep)

### Hook useJobPolling
- [ ] `src/hooks/useJobPolling.ts` con firma `useJobPolling(jobId, { intervalMs, onProgress, onComplete, onFail })`
- [ ] Limpia el interval en unmount y al alcanzar estado terminal
- [ ] PhotoGrid, ProjectsClient y ClassifyProvider lo consumen

### Fuente self-hosted
- [ ] Inter servida con `next/font/google` (self-host en build) — sin requests a fonts.googleapis.com en runtime

### Constantes de gestos
- [ ] Umbrales de long-press, double-tap y swipe como constantes nombradas (en `config.ts` o `src/lib/gestures.ts`)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/hooks/useJobPolling.ts` | Nuevo hook compartido |
| `src/lib/types.ts` | Tipos consolidados |
| `src/app/layout.tsx` | next/font |
| `src/components/PhotoGrid.tsx`, `ClassifyProvider.tsx`, `src/app/projects/ProjectsClient.tsx` | Adoptar hook + tipos |
| `.gitignore` | Patrón *.db en raíz |

---

## Notas técnicas

- `next/font` con `subsets: ['latin']` y pesos 300–600 replica el `<link>` actual; eliminar también los preconnect.
- Hacer la migración al hook en el mismo PR que su creación para no dejar un cuarto patrón conviviendo con los tres viejos.

---

## Fuera de alcance (v1)

- Trocear `globals.css` y `Sidebar.tsx` (refactor mayor, cubierto en espíritu por US-087)
- Migrar estilos inline de StatsClient a clases
