> **Estado: ✅ Desplegada** — merged en main el 2026-05-23 (PR #35)

# Feature: Empty states y onboarding con llamadas a la acción

## Historia de usuario

Como usuario nuevo de photoshelf o que accede a una sección sin contenido,
quiero ver mensajes claros con instrucciones sobre qué hacer a continuación,
para no quedarme bloqueado frente a una pantalla vacía sin saber cómo empezar.

---

## Descripción

El mayor problema de onboarding actual es que al instalar la app por primera vez, el usuario
ve el timeline completamente vacío sin ninguna indicación de qué hacer. No hay un estado vacío
que explique "Ejecuta el escáner para indexar tus fotos". Lo mismo ocurre en búsqueda (sin
resultados: pantalla vacía), en tags (no hay tags todavía) y en proyectos (lista vacía).

Esta US define y aplica un patrón de empty state consistente en toda la app:
**icono + mensaje descriptivo + botón de acción principal (CTA)**.

---

## Criterios de aceptación

### Timeline vacío (primera instalación)
- [ ] Cuando no hay fotos en la DB, el timeline muestra:
  - Icono grande de galería/cámara (SVG, ~48px)
  - Título: "Tu biblioteca está vacía"
  - Subtítulo: "Ejecuta el escáner para indexar las fotos de tu NAS"
  - Botón CTA: "Ir al escáner" que navega a `/scan` o abre el panel de escaneo

### Búsqueda sin resultados
- [ ] Cuando una búsqueda no devuelve resultados, se muestra:
  - Icono de lupa con X
  - Mensaje: "No se encontraron fotos para «{término}»"
  - Sugerencia: "Prueba con otros términos o revisa los filtros activos"
  - Botón: "Limpiar búsqueda"

### Tags vacíos
- [ ] Cuando no hay tags en la BD, la vista de tags muestra:
  - Mensaje: "Aún no hay etiquetas"
  - Subtítulo: "Los tags se generan automáticamente al clasificar tus fotos con IA"
  - Botón: "Clasificar fotos" que inicia el scan con clasificación

### Proyectos vacíos
- [ ] Cuando no hay proyectos creados, la lista muestra:
  - Mensaje: "Aún no tienes proyectos fotográficos"
  - Botón: "Crear proyecto" que abre el flujo de creación

### Diseño consistente
- [ ] Todos los empty states usan el mismo componente `<EmptyState>` con props: `icon`, `title`, `subtitle?`, `action?`
- [ ] El componente se centra vertical y horizontalmente en el área de contenido
- [ ] El CTA usa el estilo de botón primario existente en la app

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/EmptyState.tsx` | Nuevo — componente genérico de empty state |
| `src/app/(library)/page.tsx` | Usar `<EmptyState>` cuando no hay fotos |
| `src/components/SearchResults.tsx` | Empty state para búsqueda sin resultados |
| `src/app/tags/page.tsx` | Empty state para lista de tags vacía |
| `src/app/projects/page.tsx` | Empty state para lista de proyectos vacía |

---

## Notas técnicas

- El componente `EmptyState` debe ser Server-renderable (sin hooks de estado)
- Los iconos pueden ser del mismo set de Lucide React que ya usa la app
- No requiere nueva API — usa datos ya disponibles en las páginas

---

## Fuera de alcance (v1)

- Onboarding step-by-step (wizard de configuración inicial)
- Tour interactivo de la app (tooltips secuenciales)
- Animaciones elaboradas en el empty state
- Tracking de "primera visita" con localStorage
