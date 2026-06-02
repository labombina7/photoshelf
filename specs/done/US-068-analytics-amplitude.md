# Feature: Analytics de producto con Amplitude

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador del producto photoshelf,
quiero integrar Amplitude para registrar eventos clave de uso,
para entender cómo los usuarios interactúan con la app, qué flujos funcionan y dónde se pierden.

---

## Descripción

Photoshelf no tiene ningún tipo de telemetría de producto hoy en día. Sin datos, cualquier decisión de roadmap es una intuición: ¿los usuarios usan la búsqueda IA o el sidebar? ¿Abren el detalle de la foto? ¿El clasificador de intención sirve para algo?

Esta US integra Amplitude como capa de analytics del lado cliente. El objetivo inicial es instrumentar los flujos más críticos y tener un dashboard básico que responda las preguntas más importantes: qué hacen los usuarios, con qué frecuencia, y dónde abandonan.

La integración debe ser ligera, no bloqueante para el render, y respetuosa con la arquitectura existente: se centraliza en un hook `useAnalytics` y los eventos se disparan en los componentes, no en los route handlers.

---

## Criterios de aceptación

### Setup e inicialización
- [ ] SDK de Amplitude instalado (`@amplitude/analytics-browser`)
- [ ] API Key configurada via variable de entorno `NEXT_PUBLIC_AMPLITUDE_API_KEY`
- [ ] Inicialización en el layout raíz — solo en cliente, no bloquea SSR
- [ ] En desarrollo (NODE_ENV=development), los eventos se loguean en consola pero NO se envían a Amplitude

### Eventos instrumentados — Navegación
- [ ] `page_viewed` — cada vez que el usuario carga una página principal (home, detalle de foto, stats, search results); incluye propiedad `page`
- [ ] `sidebar_filter_applied` — al activar un filtro de sidebar (año, evento, tag, favorito, EXIF); incluye `filter_type` y `filter_value`
- [ ] `sidebar_filter_cleared` — al limpiar todos los filtros

### Eventos instrumentados — Fotos
- [ ] `photo_opened` — al abrir el modal/detalle de una foto; incluye `photo_id` y `source` (grid, search, slideshow)
- [ ] `photo_favorited` — al marcar/desmarcar favorita; incluye `action` (add/remove)
- [ ] `photo_downloaded` — al descargar el original

### Eventos instrumentados — Búsqueda
- [ ] `search_performed` — al ejecutar una búsqueda; incluye `query_length` (no el texto, por privacidad), `intent` (si el clasificador lo detecta)
- [ ] `search_result_clicked` — al hacer click en un resultado de búsqueda

### Eventos instrumentados — IA
- [ ] `ai_classify_triggered` — al lanzar clasificación manual
- [ ] `ai_tag_reviewed` — al confirmar o rechazar un tag IA; incluye `action` (confirm/reject)

### Privacidad
- [ ] **Nunca** enviar a Amplitude: nombres de fichero, paths, tags de contenido, queries de búsqueda literales, ni ningún dato personal
- [ ] Los IDs de foto que se envíen son IDs numéricos internos de BD — no paths ni nombres

---

## Implementación técnica

### Estructura de archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/lib/analytics.ts` | Inicialización de Amplitude + función `track()` con guard de dev |
| `src/hooks/useAnalytics.ts` | Hook React que expone `track` con el contexto de usuario (si aplica) |

### Patrón de uso en componentes

```typescript
// En un componente cliente
const { track } = useAnalytics();

// Al abrir una foto
track('photo_opened', { photo_id: photo.id, source: 'grid' });
```

### Guard de desarrollo

```typescript
// src/lib/analytics.ts
export function track(event: string, props?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Amplitude]', event, props);
    return;
  }
  amplitudeTrack(event, props);
}
```

---

## Componentes modificados

| Componente | Eventos añadidos |
|---|---|
| `src/app/layout.tsx` | Inicialización de Amplitude |
| `src/components/PhotoGrid.tsx` | `photo_opened` |
| `src/components/Sidebar.tsx` | `sidebar_filter_applied`, `sidebar_filter_cleared` |
| `src/components/SearchBar.tsx` | `search_performed` |
| `src/app/(vistas)/search/page.tsx` | `search_result_clicked` |
| `src/components/PhotoDetail.tsx` | `photo_favorited`, `photo_downloaded` |
| `src/components/AiClassifyButton.tsx` | `ai_classify_triggered` |

---

## Notas técnicas

- Amplitude Browser SDK carga de forma asíncrona — no afecta al TTI
- Si `NEXT_PUBLIC_AMPLITUDE_API_KEY` no está definida, `track()` es un no-op silencioso (no lanza error)
- No usar `identify()` con datos de usuario por ahora — el objetivo es analytics de comportamiento, no usuarios identificados
- El SDK de Amplitude ya hace batching y retry interno — no necesitamos lógica extra de reintentos

---

## Fuera de alcance (v1)

- Dashboard de Amplitude personalizado (se hace en la UI de Amplitude, no en código)
- Funnels o cohorts (requieren tener datos primero)
- Analytics server-side / eventos desde route handlers
- Consentimiento de cookies / banner GDPR (app local, sin usuarios externos por ahora)
- Identificación de usuarios (`amplitude.identify()`)
