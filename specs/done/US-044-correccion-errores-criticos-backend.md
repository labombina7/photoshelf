# Feature: Corrección de errores críticos en background tasks y manejo de fallos silenciosos

> Estado: ✅ Desplegada — PR #82 mergeada el 2026-05-30

## Historia de usuario

Como fotógrafo que usa la clasificación automática y la búsqueda IA,
quiero que las operaciones en segundo plano completen siempre correctamente y que los fallos individuales sean visibles en los logs,
para no encontrarme con clasificaciones incompletas sin explicación ni resultados de búsqueda vacíos sin saber por qué.

---

## Descripción

La auditoría de deuda técnica identificó tres bugs en el manejo de errores del backend que pueden causar pérdida silenciosa de datos o comportamiento inesperado:

**1. `classify/year` usa fire-and-forget sin `after()`**: el route handler lanza la clasificación en un IIFE (`(async () => {})()`) y devuelve 202 inmediatamente. Sin embargo, sin anclar el proceso al runtime de Next.js con `after()`, la clasificación puede ser abortada cuando Next.js libera el contexto del request, especialmente en entornos serverless o con cold starts. Otros handlers similares (`scan/route.ts`) ya usan `after()` correctamente.

**2. Catch vacío en `ai/search` modo deep**: el bloque `catch { /* skip on error for individual photo */ }` en el bucle de búsqueda profunda no registra ningún log. Si Ollama falla en las 50 fotos analizadas, el usuario recibe un resultado vacío sin ninguna traza que explique qué ocurrió.

**3. Actualizaciones optimistas sin rollback en `DetailPanel`**: `removeTag` y `toggleTheme` actualizan el estado local del componente antes de confirmar con el servidor (optimistic update) pero no tienen `try/catch`. Si la red falla o el servidor devuelve un error, el estado local queda desincronizado de la base de datos sin notificar al usuario.

---

## Criterios de aceptación

### `classify/year` con `after()`
- [ ] El IIFE de clasificación en `src/app/api/ai/classify/year/route.ts` se reemplaza por `after(async () => { ... })` de `next/server`
- [ ] El handler devuelve HTTP 202 inmediatamente, igual que antes, pero ahora el proceso de clasificación está anclado al runtime
- [ ] El comportamiento y la respuesta del endpoint son idénticos desde el punto de vista del cliente

### Logging en catch de `ai/search` modo deep
- [ ] El bloque `catch {}` vacío en `src/app/api/ai/search/route.ts:78` pasa a registrar: `console.error('[ai/search] photo error:', candidate.id, err instanceof Error ? err.message : err)`
- [ ] El bucle sigue continuando con la siguiente foto (no aborta la búsqueda completa)
- [ ] Si todas las fotos del bucle fallan, el endpoint devuelve un array vacío con un log que permite diagnosticar el problema

### Rollback en `DetailPanel.removeTag` y `toggleTheme`
- [ ] `removeTag` en `DetailPanel.tsx` envuelve el `fetch` en `try/catch`
- [ ] Si el `fetch` falla, revierte el estado local al valor anterior (rollback del optimistic update)
- [ ] Se muestra un toast de error al usuario: "No se pudo eliminar la etiqueta. Inténtalo de nuevo."
- [ ] `toggleTheme` aplica el mismo patrón: try/catch + rollback + toast en caso de error
- [ ] Los toasts de error usan el mismo sistema de notificaciones que el resto de la app

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/ai/classify/year/route.ts` | Reemplazar IIFE por `after()` de next/server |
| `src/app/api/ai/search/route.ts` | Añadir `console.error` en el catch del bucle de modo deep |
| `src/components/DetailPanel.tsx` | `try/catch` + rollback + toast en `removeTag` y `toggleTheme` |

---

## Notas técnicas

- `after()` está disponible desde Next.js 15 (`import { after } from 'next/server'`). Ya se usa en `scan/route.ts` — copiar el patrón exacto.
- Para el rollback en `removeTag`, guardar el valor del tag antes de eliminarlo del state: `const prevTags = tags; setTags(tags.filter(...)); try { await fetch(...) } catch { setTags(prevTags); showErrorToast('...') }`
- El sistema de toasts ya existe en la app — verificar cómo se usa en otros componentes (p.ej. en `ScanProvider.tsx`) para mantener consistencia.

---

## Fuera de alcance (v1)

- Retry automático con backoff exponencial en fallos de red del DetailPanel
- ARIA live regions para anunciar errores de forma accesible
- Persistencia del estado de clasificación en SQLite para recuperación ante reinicios del proceso
