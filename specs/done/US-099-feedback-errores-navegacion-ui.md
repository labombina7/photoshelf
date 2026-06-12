# Feature: Feedback de errores y navegación honesta en la UI

## Historia de usuario

Como usuario de photoshelf,
quiero que la interfaz me diga la verdad — que los botones hagan lo que prometen, que los errores se muestren y que los enlaces conserven el contexto,
para confiar en lo que veo en pantalla.

---

## Descripción

El UX audit del 2026-06-12 agrupa varios casos donde la UI miente u oculta información:

1. **CTA del estado vacío sin acción**: con biblioteca vacía, el botón «Reescanear biblioteca» (`PhotoGrid.tsx:546-560`) es un link a `/library` — no lanza ningún escaneo.
2. **Favorito que falla en silencio**: `toggleFavorite` del DetailPanel (`DetailPanel.tsx:131-140`) hace optimistic update sin try/catch ni revert; si la API falla, la estrella queda en un estado falso. La versión de PhotoGrid sí revierte.
3. **Error de clasificación siempre culpa a Ollama**: cualquier fallo del batch muestra «Ollama no disponible» (`PhotoGrid.tsx:323-329`) aunque la causa sea otra — el campo `error_last` del job ya contiene el error real.
4. **Generación de proyectos sin salida**: el polling (`ProjectsClient.tsx:109-128`) no expira nunca ni se limpia al desmontar; sin botón de cancelar.
5. **«Ver en biblioteca →» pierde granularidad**: desde un grupo de mes/día del timeline siempre se enlaza al año completo (`TimelineClient.tsx:334-341`).
6. **Ctrl+scroll secuestrado globalmente** en el timeline (`window` listener con `preventDefault`), impidiendo el zoom del navegador.

---

## Criterios de aceptación

### CTA del estado vacío
- [ ] El botón del estado vacío lanza `startScan()` del ScanProvider (con el toast de progreso habitual)
- [ ] Si no hay catálogo configurado, el CTA lleva a `/settings/catalogs` con label acorde

### Favorito con revert
- [ ] `toggleFavorite` del DetailPanel revierte el estado si el PATCH falla y muestra el `errorToast` existente
- [ ] Mismo patrón que `PhotoGrid.tsx:228-267`

### Errores de clasificación honestos
- [ ] El resumen del batch muestra el `error_last` del job o un genérico con enlace a la Cola de trabajos
- [ ] «Ollama no disponible» solo aparece cuando el error es de conexión a Ollama

### Generación de proyectos
- [ ] Botón «Cancelar» durante la generación (la API de jobs soporta cancelled)
- [ ] Timeout de cortesía (~3 min) con mensaje y enlace a `/jobs`
- [ ] El interval de polling se limpia al desmontar el componente

### Navegación del timeline
- [ ] «Ver en biblioteca →» conserva el periodo: a nivel mes/día enlaza con el filtro temporal correspondiente (o al evento dominante del grupo)
- [ ] El listener de Ctrl+wheel se limita al contenedor del timeline, no a `window`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/PhotoGrid.tsx` | CTA con acción real + mensaje de error del job |
| `src/components/DetailPanel.tsx` | Revert + toast en favorito |
| `src/app/projects/ProjectsClient.tsx` | Cancelación, timeout y cleanup del polling |
| `src/app/timeline/TimelineClient.tsx` | Enlace granular + scope del wheel listener |

---

## Notas técnicas

- Para el enlace granular del timeline puede necesitarse soporte de filtro por mes en `/library` (`?year=YYYY&month=MM`) — si no existe, enlazar al año con anchor es aceptable como paso intermedio; documentar la decisión.
- La cancelación de proyectos reutiliza `PATCH /api/jobs/:id` → `cancelled` (ya soportado por el worker, que comprueba el estado por batch).

---

## Fuera de alcance (v1)

- Sistema global de toasts (se reutilizan los mecanismos locales existentes)
- Reintentos automáticos de operaciones fallidas

> Estado: ✅ Desplegada
