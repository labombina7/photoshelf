# Feature: Corrección de variables CSS no definidas

> Estado: ✅ Desplegada — PR #75 mergeado el 2026-05-30

## Historia de usuario

Como usuario de photoshelf,
quiero que todos los elementos visuales (FAB de búsqueda, skeleton de carga, marcadores del mapa) se rendericen correctamente,
para no encontrarme con bordes invisibles, fondos rotos o colores de acento inconsistentes.

---

## Descripción

El sistema de tokens CSS de photoshelf tiene tres variables referenciadas en el código pero no declaradas en `:root`: `--border2`, `--bg-secondary` y `--accent`/`--accent-rgb`. Estas omisiones producen bugs visuales silenciosos que el navegador resuelve como valores vacíos o con el fallback explícito del `var()`, lo que causa:

- **`--border2`**: el borde del FAB de búsqueda mobile (`.mobile-search-fab`) no se renderiza, haciéndolo visualmente menos distinguible del fondo.
- **`--bg-secondary`**: el fondo del skeleton shimmer de `.photo-item-wrapper` queda sin color definido, degradando la animación de carga.
- **`--accent` / `--accent-rgb`**: los marcadores del mapa, los botones de año activos y los enlaces del panel del mapa usan `var(--accent, #3b62d4)` con fallback hardcodeado, lo que hace que el color de acción principal no sea configurable desde `:root`. También hay inconsistencia con `--tag-auto-color: #3b62d4` que ya existe.

Esta US declara las tres variables en `:root` con los valores semánticamente correctos y elimina los fallbacks hardcodeados innecesarios.

---

## Criterios de aceptación

### Variables CSS declaradas
- [ ] `--border2: #dbd9d4;` añadida en `:root` (tono intermedio entre `--border` y `--border-light`)
- [ ] `--bg-secondary: #f0ede8;` añadida en `:root` (valor que permite al skeleton fundirse con el fondo)
- [ ] `--accent: #3b62d4;` añadida en `:root`
- [ ] `--accent-rgb: 59,98,212;` añadida en `:root`

### Usos actualizados
- [ ] `.mobile-search-fab` en `globals.css` usa `var(--border2)` correctamente (ya lo usaba — ahora funciona)
- [ ] `.photo-item-wrapper` y `.photo-skeleton` usan `var(--bg-secondary)` correctamente
- [ ] Los fallbacks hardcodeados `var(--accent, #3b62d4)` pueden simplificarse a `var(--accent)` donde corresponda
- [ ] `--tag-auto-color` puede coexistir con `--accent` o apuntar a él — no deben divergir en valor

### Verificación visual
- [ ] El borde del FAB de búsqueda mobile es visible en iOS Safari y Chrome Android
- [ ] El skeleton shimmer de la biblioteca muestra la animación de gradiente correctamente
- [ ] Los marcadores del mapa y los botones de año activos usan el mismo tono de azul que el resto de acentos

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/globals.css` | Añadir `--border2`, `--bg-secondary`, `--accent`, `--accent-rgb` en `:root` |

---

## Notas técnicas

- Verificar con DevTools que ninguna propiedad queda como `var(--xxx)` sin resolver (aparecería sin color en el panel de Computed Styles)
- Los fallbacks `var(--accent, #3b62d4)` en `map-year-btn.active`, `.map-panel-link`, `.map-marker-dot` y `CatalogsClient.tsx` son seguros de mantener — son redundantes una vez definida la variable pero no causan daño
- `--bg-tertiary` ya tiene fallback explícito `var(--bg-tertiary, #e8e8e8)` — revisar si también debería declararse en `:root` por consistencia

---

## Fuera de alcance (v1)

- Modo oscuro (dark mode) — requiere US propia con variables CSS alternativas
- Auditoría completa del design token system
- Generación automática de tokens desde Figma o equivalente
