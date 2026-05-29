# US-028: Shell de la barra de búsqueda en el header

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** M
> **Dependencias:** —

---

## Historia

**Como** usuario de photoshelf,  
**quiero** tener una barra de búsqueda centrada y visible en el header de la app,  
**para** poder iniciar cualquier búsqueda desde cualquier vista sin tener que ir al sidebar.

---

## Contexto

Actualmente el header (`src/app/layout.tsx`) solo envuelve a los providers — no existe un header visual global. La búsqueda IA está encapsulada en `AISearchPanel`, un panel deslizante del sidebar accesible únicamente desde el botón "Buscar".

Esta US crea el **componente `AppHeader`** con la barra centrada. No conecta todavía con ningún backend de búsqueda (eso es US-030 y US-031) — entrega el shell visual y la interacción básica.

---

## Criterios de aceptación

- [ ] El layout global muestra un header fijo en la parte superior con tres zonas: logo/marca (izquierda), barra de búsqueda (centro), acciones (derecha)
- [ ] La barra de búsqueda ocupa ~40% del ancho del header en desktop
- [ ] Al hacer foco en la barra (click o ⌘K), se activa visualmente (borde iluminado)
- [ ] El atajo de teclado **⌘K** (Mac) / **Ctrl+K** (Windows/Linux) enfoca la barra desde cualquier vista
- [ ] La barra muestra un placeholder descriptivo: `Busca fotos, tags, eventos… o pregunta en lenguaje natural`
- [ ] Al escribir, aparece un dropdown inline con sugerencias (vacío por ahora, se rellena en US-033)
- [ ] Pulsar **Enter** o el icono de lupa dispara la búsqueda (navega a `/search?q=...`)
- [ ] Pulsar **Escape** limpia el foco y cierra el dropdown
- [ ] En mobile (< 768px), la barra se colapsa a un icono de lupa que al pulsar expande la barra a pantalla completa
- [ ] El componente vive en `src/components/AppHeader.tsx`
- [ ] El layout (`src/app/layout.tsx`) integra `AppHeader` por encima del área de contenido principal
- [ ] El header no rompe la navegación del sidebar existente

---

## Notas técnicas

- El header debe ser `position: sticky; top: 0` con z-index por encima del sidebar pero por debajo de modales
- El input usa `useRouter` de Next.js para navegar a `/search` al hacer submit
- El shortcut ⌘K se registra con un `useEffect` sobre `document.addEventListener('keydown', ...)` en un hook `useSearchShortcut`
- La barra de búsqueda en mobile puede usar un estado local `expanded` gestionado en el propio `AppHeader`
- No añadir animaciones complejas — foco simple con CSS `transition: border-color 150ms`

---

## Diseño (wireframe textual)

```
┌─────────────────────────────────────────────────────────────┐
│  [photoshelf]    [  🔍 Busca fotos, tags, eventos…   ]  [⚙] │
└─────────────────────────────────────────────────────────────┘
                          ↕ sticky
┌────────┬────────────────────────────────────────────────────┐
│Sidebar │  Área principal                                     │
│        │                                                     │
```

---

## Fuera de alcance

- Conectar con resultados de búsqueda reales (US-030, US-031)
- Autocomplete con datos de tags/eventos (US-033)
- Indicador visual de "modo IA" en la barra (US-032)
---

> Estado: ✅ Desplegada
