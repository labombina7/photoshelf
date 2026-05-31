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
- Si `is_favorite === 1`: estrella rellena, color amarillo/dorado (`#f5c518` o similar).
- Si `is_favorite === 0`: sin estrella visible (o estrella fantasma al hacer hover sobre esa foto).
- Al hacer click en la estrella, toggle del favorito (igual que espacio desde teclado) sin navegar al detalle.
- El icono tiene cursor pointer y no propaga el click al enlace de la foto.

---

## Criterios de aceptación

- [ ] Las flechas del teclado navegan entre fotos en el grid respetando columnas.
- [ ] La foto enfocada muestra un anillo de selección claro.
- [ ] Espacio o F toglea el favorito de la foto enfocada y actualiza el icono al instante.
- [ ] El icono ★ aparece en todos los thumbnails que sean favoritos.
- [ ] Al hover sobre un thumbnail no favorito, aparece una estrella semitransparente.
- [ ] Click en la estrella toglea favorito sin abrir el detalle.
- [ ] La navegación funciona en todas las vistas que usan `PhotoGrid`.
- [ ] Si no hay foto enfocada y el usuario presiona una flecha, se enfoca la primera foto.
- [ ] Las teclas no interfieren cuando el foco está en un input u otro elemento interactivo.

---

## Notas de implementación

### Enfoque arquitectónico

El estado de foco y la lógica de teclado se implementan **dentro de `PhotoGrid`** (componente compartido), para que funcione igual en todas las vistas sin tocar cada página.

- `focusedIndex: number | null` — índice de la foto enfocada en el array actual.
- El número de columnas se puede calcular con un `ResizeObserver` sobre el contenedor del grid.
- El `keydown` listener se adjunta al `div.photo-grid` con `tabIndex={0}` (para que pueda recibir foco de teclado) o al `document` con guard de `document.activeElement`.

### Toggle de favorito

- `PhotoGrid` recibe las fotos como prop. Para el update optimista:
  - Mantener copia local del array de fotos en estado (`useState`), inicializado desde la prop.
  - Al hacer toggle, actualizar el array local inmediatamente y llamar al API en background.
  - Si el API falla, revertir el cambio local y mostrar error breve (toast o `alert`).

### Icono de estrella

- SVG inline o carácter unicode `★`/`☆` con `aria-label="Favorita"`.
- Posición absoluta sobre el thumbnail: `position: absolute; top: 6px; right: 6px`.
- Z-index suficiente para quedar sobre la imagen.
- El contenedor del thumbnail ya debe tener `position: relative`.

### Columnas del grid

El grid usa CSS grid. Para calcular columnas dinámicamente:

```typescript
const cols = Math.round(containerWidth / CELL_WIDTH);
```

O leer el valor del DOM tras render:

```typescript
const cols = getComputedStyle(gridRef.current)
  .gridTemplateColumns.split(' ').length;
```

---

## API involucrada

| Método | Ruta | Uso |
|---|---|---|
| `PATCH` | `/api/photos/{id}` | Toggle favorito — body: `{ is_favorite: boolean }` |

El endpoint ya existe y está implementado.

---

## Archivos clave a modificar

| Archivo | Cambio |
|---|---|
| `src/components/PhotoGrid.tsx` | Estado de foco, keydown handler, icono de estrella, toggle optimista |
| `src/app/globals.css` | Estilos del anillo de selección y de la estrella |

No se necesitan cambios en el backend ni en las pages individuales.
