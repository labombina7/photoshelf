# Feature: Modo comparación de fotos (side-by-side)

## Historia de usuario

Como fotógrafo que trabaja con ráfagas o fotos similares de un mismo evento,
quiero poder comparar dos fotos en pantalla completa una al lado de la otra,
para decidir rápidamente cuál tiene mejor enfoque, exposición o composición y cuál marcar como favorita.

---

## Descripción

Una de las tareas más frecuentes en la edición y curación de una biblioteca fotográfica es elegir la mejor foto de una serie similar: ráfagas, fotos del mismo momento desde diferentes ángulos, o variaciones de encuadre. Actualmente photoshelf solo permite ver una foto a la vez, lo que obliga al usuario a navegar hacia adelante y hacia atrás para comparar, perdiendo el estado visual de la foto anterior.

El modo comparación muestra dos fotos en columnas iguales a pantalla completa, con controles para: intercambiar una de las dos fotos por otra del mismo evento, marcar favorita desde la vista comparación, y cerrar para volver al detalle.

La selección de la segunda foto para comparar se realiza desde la biblioteca o el detalle de la primera foto, sin interrumpir el flujo natural.

---

## Criterios de aceptación

### Activar la comparación
- [ ] En el detalle de foto desktop, existe un botón "Comparar" (o icono de dos columnas) en la barra de acciones
- [ ] Al pulsarlo, aparece un selector lateral con las fotos del mismo evento para elegir la foto de comparación
- [ ] Alternativamente, desde la biblioteca se pueden seleccionar dos fotos con Shift+Click o un checkbox y activar "Comparar selección"
- [ ] La URL cambia a `/compare?a=ID1&b=ID2` para que la vista sea compartible/enlazable

### Vista de comparación
- [ ] Las dos fotos se muestran en columnas de igual ancho ocupando el 100% de la pantalla
- [ ] Cada columna tiene en la parte superior: nombre del archivo, fecha y un botón de estrella para marcar como favorita
- [ ] Haciendo click en cualquiera de las dos fotos, se abre su detalle completo en una nueva pestaña o en un modal
- [ ] En mobile, las fotos se apilan verticalmente en lugar de columnas (scroll para ver la segunda)

### Navegación en la comparación
- [ ] Los atajos de teclado `A` (flecha izquierda) y `D` (flecha derecha) navegan entre fotos dentro de la columna activa
- [ ] Hacer click en una columna la "activa" para la navegación con teclado
- [ ] La tecla `Escape` cierra la vista de comparación y vuelve al detalle de la primera foto

### Acciones desde la comparación
- [ ] Se puede marcar/desmarcar como favorita cada foto desde la vista de comparación (sin salir)
- [ ] El botón "Elegir esta" en cada columna cierra la comparación y navega al detalle de la foto elegida
- [ ] Los cambios de favorito se persisten en la base de datos en tiempo real

---

## API necesaria

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/photos?ids=ID1,ID2` | GET | Obtener datos de dos fotos por ID (o reutilizar el endpoint existente) |

---

## Ruta y navegación

- Nueva página: `src/app/compare/page.tsx` (o modal a pantalla completa desde el detalle)
- URL: `/compare?a={photoId}&b={photoId}`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/compare/page.tsx` | Nuevo — página de comparación side-by-side |
| `src/app/compare/CompareClient.tsx` | Nuevo — lógica de comparación con teclado y acciones |
| `src/app/library/[photoId]/PhotoDetailClient.tsx` | Añadir botón "Comparar" en la barra de acciones |

---

## Notas técnicas

- La ruta `/compare` puede ser una página independiente o un modal a pantalla completa activado desde el detalle — la URL con query params `?a=&b=` permite ambas aproximaciones
- Para el selector de segunda foto, reutilizar el componente de lista de fotos existente filtrado por el mismo `event` y `year` que la foto activa
- Los thumbnails de alta resolución (`size=1920`) ya están disponibles en el endpoint `/api/photos/[id]/thumbnail?size=1920` — usarlos para la comparación
- `object-fit: contain` en las imágenes para que no se recorten y se vea la foto completa

---

## Fuera de alcance (v1)

- Comparación de más de 2 fotos simultáneamente (grid de 4)
- Zoom sincronizado entre las dos fotos
- Anotaciones o marcas sobre la foto para señalar diferencias
- Exportar la comparación como imagen PNG
