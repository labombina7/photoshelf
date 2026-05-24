# Feature: Personalidad visual — micro-interacciones, iconografía y voz de la app

> Estado: ✅ Desplegada — PR #42 · 2026-05-24

## Historia de usuario

Como usuario de photoshelf,
quiero que la interfaz tenga un carácter visual propio y coherente,
para sentir que uso una herramienta con identidad — no un prototipo funcional.

---

## Descripción

photoshelf tiene una estética cuidada (modo oscuro, paleta consistente, tipografía limpia) pero
carece de *personalidad*: los estados de hover son planos, la iconografía tiene inconsistencias
de trazo, el copy de los botones es genérico, y no hay micro-animaciones que hagan la interfaz
viva. La app funciona, pero no transmite carácter.

Esta US aplica una capa de pulido visual en cuatro áreas: **consistencia de iconografía**,
**jerarquía tipográfica**, **voz y tono en el copy**, y **micro-interacciones** (transiciones,
hover states, feedback visual). No añade funcionalidad nueva — refina la que existe.

El objetivo es que al abrir photoshelf el usuario sienta que está en *su* app de fotos, no en
un dashboard genérico.

---

## Criterios de aceptación

### Iconografía consistente

- [ ] Todos los iconos en `Icons.tsx` usan `strokeWidth="1.8"` de forma uniforme (eliminar los
  que usan 2 o 2.5 sin justificación)
- [ ] Los tamaños por defecto de los iconos siguen una escala coherente: `12` (inline en texto),
  `16` (controles de UI), `20` (acciones primarias), `32` (ilustraciones / empty states)
- [ ] Se elimina el icono duplicado `IconGrid` / `IconViewGrid` — se consolida en uno solo
- [ ] Los controles de zoom tienen `title` visible en hover: "Acercar" / "Alejar"
- [ ] Todos los botones icon-only tienen `title` además de `aria-label` para mostrar tooltip nativo

### Jerarquía tipográfica

- [ ] En `DetailPanel`, los labels de metadatos (Fecha, Cámara, Exposición…) usan `font-weight: 500`
  y `color: var(--text-secondary)`; los valores usan `font-weight: 400` y `color: var(--text-primary)`
- [ ] En la sidebar, las secciones (BIBLIOTECA, TEMÁTICAS, HERRAMIENTAS) tienen `letter-spacing: 0.08em`
  para diferenciarlas visualmente de los items de navegación
- [ ] Los contadores de foto (ej. "0" junto a "Todas las fotos") usan un tamaño de fuente uno
  paso menor que el label, con `color: var(--text-tertiary)`

### Voz y tono — copy

- [ ] El botón de crear temática dice "Nueva temática" → ya correcto; verificar que no hay
  "Guardar" ni "Cancelar" sin contexto (sustituir por "Guardar cambios" / "Descartar")
- [ ] Los empty states usan primera persona de la app, con carácter:
  - Biblioteca vacía: "Tu biblioteca está vacía. Empieza escaneando tu carpeta de fotos."  
  - Tags vacíos: "Aún no hay etiquetas. Se generan al clasificar fotos con IA." *(ya desplegado — verificar copy)*
  - Timeline vacío: "Nada que mostrar aquí todavía."
- [ ] Los errores de operación usan tono directo sin jerga técnica: "No se pudo guardar" en lugar
  de "Error 500" o "Internal Server Error" visible al usuario

### Micro-interacciones

- [ ] Los thumbnails de la biblioteca tienen `transition: transform 150ms ease-out` en hover
  (scale 1.02, sin desplazamiento de layout — usar `transform: scale`)
- [ ] Los botones de acción primaria (Escanear, Clasificar con IA) tienen estado `active` con
  ligero `scale(0.97)` al pulsarlos
- [ ] Los tags en `DetailPanel` y en la nube de tags tienen `transition: background-color 120ms`
  en hover para feedback inmediato
- [ ] El sidebar tiene `transition: opacity 200ms` al aparecer/desaparecer en móvil
- [ ] Los contadores de carga (spinner) usan la variable `--accent` en lugar del color de texto,
  para que sean visualmente identificables como "algo está pasando"
- [ ] Las transiciones no superan 200ms en acciones de respuesta directa (hover, click) para no
  parecer lentas

---

## Componentes modificados

| Componente | Cambio |
|---|---|
| `src/components/Icons.tsx` | Unificar strokeWidth, escala de tamaños, eliminar duplicado |
| `src/components/DetailPanel.tsx` | Jerarquía tipográfica en metadatos |
| `src/components/Sidebar.tsx` | Letter-spacing en secciones, title en botones |
| `src/components/EmptyState.tsx` | Revisar y actualizar copy con voz propia |
| `src/components/PhotoGrid.tsx` | Hover con scale en thumbnails |
| `src/app/globals.css` | Variables de transición, hover states globales |
| `src/app/timeline/TimelineClient.tsx` | Title en controles de zoom |

---

## Notas técnicas

- Todas las transiciones deben respetar `prefers-reduced-motion`: envolver en
  `@media (prefers-reduced-motion: no-preference)` en globals.css
- El `scale` en thumbnails debe aplicarse sobre el `<img>` o un wrapper con `overflow: hidden`,
  no sobre el contenedor del grid (evita que el efecto desborde la celda)
- Los `title` en botones son complemento de `aria-label`, no sustituto — mantener ambos
- No usar librerías de animación externas (Framer Motion, etc.) — CSS puro es suficiente
  para este alcance y no añade bundle size

---

## Fuera de alcance (v1)

- Animaciones de transición entre páginas (page transitions con View Transitions API)
- Modo claro / light theme
- Tema de color personalizable por el usuario
- Ilustraciones custom para los empty states (puede hacerse en v2 con SVG ilustrado)
- Sonidos / haptics
