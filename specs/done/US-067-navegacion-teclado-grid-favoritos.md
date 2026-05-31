# Feature: Navegación por teclado en grid de fotos y toggle de favoritos

> Estado: ✅ Desplegada

## Historia de usuario

Como usuario que revisa su biblioteca de fotos,
quiero poder recorrer el grid con las flechas del teclado y marcar fotos como favoritas pulsando espacio,
para poder curar mi colección rápidamente sin usar el ratón.

---

## Alcance

Esta historia afecta a **todas las vistas que muestran el componente `PhotoGrid`**:

- `/library` — biblioteca principal
- `/tags/[tag]` — fotos de un tag
- `/search` — resultados de búsqueda
- `/timeline` — vista cronológica
- `/projects/[id]` — fotos de un proyecto

---

## Comportamiento esperado

### Navegación con teclado

- Al entrar en una vista de grid, la primera foto queda "enfocada" (estado interno, no focus de DOM).
- **Flechas** (`←` `→` `↑` `↓`): mueven el foco entre fotos en la dirección correspondiente, teniendo en cuenta el número de columnas actual del grid.
- Si el foco llega al borde, no se mueve (sin wrap-around).
- La foto enfocada muestra un borde/anillo de selección visible (`outline` con color de acento).
- El grid hace scroll automático para mantener la foto enfocada visible (`scrollIntoView`).
- Las teclas de flechas no hacen scroll de página mientras el grid tiene foco.

### Marcar como favorita

- **Espacio**: toggle del favorito en la foto enfocada.
  - Llama a `PATCH /api/photos/{id}` con `{ is_favorite: true/false }`.
  - Actualiza el estado local sin recargar la página.
- **F**: alternativa al espacio (misma acción).

### Icono de estrella en thumbnail

- Cada thumbnail muestra un icono de estrella (★) en la esquina superior derecha.
- Si `is_favorite === 1`: estrella rellena, color amarillo/dorado (`#f5c518`).
- Si `is_favorite === 0`: sin estrella visible (estrella fantasma al hacer hover sobre esa foto).
- Al hacer click en la estrella, toggle del favorito sin navegar al detalle.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/PhotoGrid.tsx` | Estado de foco, keydown handler, icono de estrella, toggle optimista |
| `src/app/globals.css` | Estilos del anillo de selección y de la estrella |
