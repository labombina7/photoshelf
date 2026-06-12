# Feature: Accesibilidad — contraste, reduced motion y navegación por lector de pantalla

## Historia de usuario

Como usuario con baja visión o sensibilidad al movimiento,
quiero que el texto informativo sea legible y que las animaciones respeten mis preferencias del sistema,
para poder usar photoshelf cómodamente.

---

## Descripción

Tercera pasada de accesibilidad (tras US-010 y US-042), derivada del UX audit del 2026-06-12. El hallazgo de mayor impacto: `--text-tertiary: #a8a5a0` sobre los fondos claros da un ratio de contraste ≈2.4:1, muy por debajo del 4.5:1 de WCAG AA — y se usa para información real (contadores del sidebar, fechas, labels de stats, placeholders).

Además: no existe ningún soporte de `prefers-reduced-motion` (crossfades del slideshow, sheets animados, pulsos infinitos como `classify-pulse` o el badge de jobs); quedan controles icon-only sin nombre accesible (chevrons prev/next del detalle desktop, menú «···» de eventos, view toggle de la FilterBar); y las fotos del grid (`role="button"` con `tabIndex={-1}`) no son alcanzables individualmente por lectores de pantalla.

---

## Criterios de aceptación

### Contraste
- [ ] `--text-tertiary` sube a un valor con ratio ≥3:1 sobre `--bg` y `--surface` (p.ej. `#8a8782`)
- [ ] Los datos funcionales (contadores del sidebar, fechas de fotos) usan `--text-secondary` o superior
- [ ] Verificación con herramienta de contraste sobre las 4 vistas principales

### Reduced motion
- [ ] Bloque global `@media (prefers-reduced-motion: reduce)` que anula animaciones y transiciones
- [ ] El slideshow funciona sin crossfade (corte directo) bajo reduced motion
- [ ] Los pulsos infinitos (classify-pulse, badge de jobs) se detienen bajo reduced motion

### Nombres accesibles restantes
- [ ] Links prev/next del detalle desktop con `aria-label="Foto anterior/siguiente"` (`PhotoDetailClient.tsx:319-336`)
- [ ] Botón «···» de eventos con `aria-label="Más opciones"` (`PhotoGrid.tsx:355`)
- [ ] View toggle y botón de selección de FilterBar con `aria-label` (no solo `title`)
- [ ] Botones del Slideshow ya tienen `title` — añadir `aria-label` equivalente

### Grid navegable por lector de pantalla
- [ ] Roving tabindex en `.photo-item`: el item enfocado lleva `tabIndex=0`, el resto `-1`
- [ ] Cada item expone `aria-label` con filename o tags principales

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/globals.css` | `--text-tertiary` + bloque reduced-motion |
| `src/components/PhotoGrid.tsx` | Roving tabindex + aria-labels |
| `src/app/library/[photoId]/PhotoDetailClient.tsx` | aria-labels prev/next |
| `src/components/FilterBar.tsx` | aria-labels en toggles |
| `src/components/Slideshow.tsx` | aria-labels + soporte reduced motion |

---

## Notas técnicas

- El roving tabindex se integra con la navegación por flechas ya existente (`handleGridKeyDown`) — solo cambia qué elemento es focusable, no la lógica de movimiento.
- Bloque sugerido: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`.

---

## Fuera de alcance (v1)

- Auditoría completa con lector de pantalla real (VoiceOver/NVDA) — se documenta como seguimiento
- Modo alto contraste dedicado

> Estado: ✅ Desplegada
