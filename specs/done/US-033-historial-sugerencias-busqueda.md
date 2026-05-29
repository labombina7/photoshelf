# US-033: Historial de búsquedas y sugerencias autocomplete

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** S
> **Dependencias:** US-028

---

## Historia

**Como** usuario de photoshelf,  
**quiero** ver mis búsquedas recientes y sugerencias de tags y eventos mientras escribo,  
**para** repetir búsquedas anteriores con un click y reducir los errores de escritura.

---

## Contexto

El shell de la barra de búsqueda (US-028) deja el dropdown de sugerencias vacío. Esta US lo rellena con dos fuentes de datos:

1. **Historial local** — últimas búsquedas del usuario, guardadas en `localStorage`
2. **Sugerencias de BD** — tags y eventos que coincidan con lo que el usuario escribe

No se usa Ollama ni ninguna IA en esta US. Todo es local o SQL simple.

---

## Criterios de aceptación

### Historial de búsquedas

- [ ] Al hacer foco en la barra de búsqueda (sin haber escrito nada), el dropdown muestra las últimas 5 búsquedas del usuario
- [ ] El historial se guarda en `localStorage` con la clave `photoshelf.search.history`
- [ ] Cada entrada del historial incluye: query, tipo de intent (`tag`, `ai`, etc.) y timestamp
- [ ] Las búsquedas se añaden al historial al pulsar Enter (no mientras se escribe)
- [ ] Hay un botón `Borrar historial` en el pie del dropdown que limpia el array de `localStorage`
- [ ] Las entradas del historial muestran un icono de reloj para distinguirlas de las sugerencias

### Sugerencias autocomplete

- [ ] Al escribir ≥ 2 caracteres, el dropdown muestra sugerencias en tiempo real con debounce de 200ms
- [ ] Las sugerencias se obtienen del endpoint `GET /api/search/suggestions?q={query}` (nuevo endpoint)
- [ ] El endpoint devuelve hasta 5 tags y hasta 3 eventos que contengan la query (case-insensitive)
- [ ] Las sugerencias de tags muestran un chip con el nombre del tag y el número de fotos asociadas
- [ ] Las sugerencias de eventos muestran el nombre del evento y el año
- [ ] Pulsar una sugerencia lanza la búsqueda directamente (navega a `/search?q={sugerencia}`)
- [ ] Las sugerencias y el historial conviven en el mismo dropdown: historial arriba, sugerencias debajo

### Navegación por teclado

- [ ] Las flechas ↑↓ navegan entre las entradas del dropdown
- [ ] Enter sobre una entrada del dropdown la selecciona
- [ ] Escape cierra el dropdown sin lanzar búsqueda

### Endpoint de sugerencias

- [ ] `GET /api/search/suggestions?q={query}&catalog={id}` en `src/app/api/search/suggestions/route.ts`
- [ ] Respuesta:
  ```json
  {
    "data": {
      "tags": [{ "name": "boda", "count": 23 }],
      "events": [{ "name": "Boda Sara y Juan", "year": 2022, "count": 18 }]
    }
  }
  ```
- [ ] El endpoint no requiere que la query sea exacta — usa `LIKE '%query%'`
- [ ] Tiempo de respuesta < 50ms

---

## Notas técnicas

- El historial en `localStorage` tiene un máximo de 20 entradas; al superar el límite se elimina la más antigua
- No usar un hook de debounce de terceros — implementar con `useRef` + `setTimeout` directamente
- El dropdown es un `<ul>` posicionado absolutamente por debajo del input, con `role="listbox"` y `aria-expanded`
- Las sugerencias no se cachean en el cliente (50ms de BD es suficientemente rápido)

---

## Fuera de alcance

- Sugerencias basadas en el historial de búsquedas de otros usuarios
- Sugerencias de personas/caras detectadas
- Ordenación de sugerencias por popularidad o frecuencia propia
---

> Estado: ✅ Desplegada
