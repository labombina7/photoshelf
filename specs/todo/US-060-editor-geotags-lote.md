# Feature: Inferencia automática de ubicación para fotos sin GPS

## Historia de usuario

Como fotógrafo con una cámara sin GPS o cuyo GPS falló durante un viaje,
quiero que photoshelf infiera automáticamente la ubicación de mis fotos a partir del nombre del evento y del patrón de fechas,
para enriquecer mi biblioteca con ubicaciones sin trabajo manual y ver esas fotos en el mapa.

---

## Descripción

La mayoría de réflex y mirrorless hasta 2020 no tienen GPS integrado. El resultado: miles de fotos en la biblioteca que "no existen" en el mapa. Pedir al usuario que pinche manualmente en el mapa por cada evento es un trabajo que nunca hará.

Esta US implementa un sistema de inferencia automática de coordenadas en dos capas, aplicadas en orden de confianza:

### Capa 1 — Geocodificación del nombre de carpeta

El nombre del evento/carpeta a menudo contiene la ubicación de forma explícita: `Viaje-Roma-2019`, `Boda-Marbella`, `NYC-Trip`, `Tokio-con-Luis`. Un modelo de lenguaje local (Ollama) extrae el topónimo del nombre y lo geocodifica mediante una API de geocodificación (Nominatim, que es gratuita y no envía las fotos a terceros — solo el nombre del lugar).

Confianza alta cuando el nombre contiene una ciudad o lugar reconocible. Resultado: coordenadas del centro del lugar con un radio de incertidumbre proporcional al nivel de precisión (ciudad = radio 10 km, país = radio 500 km).

### Capa 2 — Algoritmo de inferencia por "viaje"

Cuando el nombre no contiene ubicación reconocible, se aplica un algoritmo basado en el concepto de **viaje**: un grupo de fotos contiguas temporalmente que probablemente ocurrieron en el mismo lugar o en un área acotada.

El algoritmo evalúa la duración del evento y adapta la estrategia:

| Duración del evento | Estrategia | Fotos analizadas con IA | Radio de confianza |
|---|---|---|---|
| 1–2 días | Viaje corto o salida de día | 3 fotos (inicio, medio, final) | Único punto, radio 5 km |
| 3–6 días | Viaje de fin de semana largo o city break | 6 fotos | Permite 1 cluster, radio 50 km |
| 7–14 días | Viaje de vacaciones | 10 fotos distribuidas | Permite 2–3 clusters, radio 100 km |
| > 14 días | Viaje largo o residencia temporal | Inferencia parcial, señala solo los días con más concentración de fotos | Múltiples áreas |

Para cada muestra de fotos, Ollama vision describe visualmente la escena: arquitectura, vegetación, señales, tipo de paisaje. Con esas descripciones se intenta deducir la región o país. Si varias fotos de la muestra apuntan al mismo lugar → alta confianza. Si hay dispersión → se marca como "ubicación incierta" y se presentan los clusters al usuario para que elija.

### Resultado final

El sistema propone coordenadas con un nivel de confianza (`high`, `medium`, `low`) y una explicación legible: "Detectado 'Roma' en el nombre del evento — centro de Roma, Italia" o "Análisis visual de 6 fotos sugiere ciudad mediterránea con arquitectura histórica — posible España o Italia (confianza media)".

El usuario revisa las propuestas y confirma, ajusta o descarta cada una. Nunca se aplican automáticamente sin revisión.

---

## Criterios de aceptación

### Inferencia automática por nombre de carpeta (Capa 1)
- [ ] Al detectar un evento sin GPS (≥ 50% de fotos sin coordenadas), el sistema extrae el topónimo del nombre usando un prompt a Ollama: `"Extrae el nombre de lugar geográfico de este texto: '{nombre_evento}'. Si no hay ningún lugar geográfico, responde null."`
- [ ] Si Ollama no está disponible, se intenta con una heurística de regex: palabras mayúsculas ≥ 4 letras que no sean artículos o preposiciones
- [ ] El topónimo extraído se geocodifica con la API de Nominatim (OpenStreetMap, sin API key, sin envío de fotos): `https://nominatim.openstreetmap.org/search?q={topónimo}&format=json&limit=1`
- [ ] Si la geocodificación devuelve resultado con `importance > 0.5`, se considera confianza alta; entre 0.3–0.5, media; < 0.3, baja
- [ ] El sistema almacena: coordenadas propuestas, topónimo extraído, fuente (`name_inference`), confianza, y la respuesta raw de Nominatim

### Algoritmo de inferencia por viaje (Capa 2, fallback)
- [ ] Se activa cuando la Capa 1 no devuelve resultado o devuelve confianza baja
- [ ] El sistema calcula la duración del evento: `MAX(taken_at) - MIN(taken_at)` en días
- [ ] Selecciona una muestra de fotos distribuidas uniformemente en el tiempo del evento (no aleatorias) según la tabla de la descripción
- [ ] Ollama vision analiza cada foto de la muestra con el prompt: `"Describe brevemente en qué país o región del mundo parece estar tomada esta foto. Fíjate en: arquitectura, vegetación, señales de tráfico, tipo de paisaje, clima aparente. Responde con: país probable, región/ciudad si es identificable, nivel de certeza (alta/media/baja)."`
- [ ] Las respuestas se agrupan por similitud geográfica para detectar clusters
- [ ] Si todas las fotos de la muestra apuntan al mismo país/región → confianza alta, se calcula el centroide
- [ ] Si hay dispersión geográfica → se presentan los N clusters al usuario para que decida
- [ ] Si Ollama no está disponible, la Capa 2 no se ejecuta y se marca el evento como "sin inferencia posible"

### Panel de revisión de ubicaciones inferidas
- [ ] Ruta `/tools/geolocate` con lista de todos los eventos sin GPS que tienen una propuesta de inferencia
- [ ] Cada evento muestra: nombre, número de fotos, propuesta de ubicación con nivel de confianza (chip verde/ámbar/rojo), y explicación en lenguaje natural de cómo se llegó a esa propuesta
- [ ] Para cada propuesta, el usuario puede:
  - **Confirmar** — acepta la ubicación propuesta y se aplica a todas las fotos del evento
  - **Ajustar** — abre un mini-mapa para corregir el punto manualmente
  - **Descartar** — descarta la propuesta sin aplicar nada
- [ ] Las propuestas de confianza alta se listan primero
- [ ] Un botón "Confirmar todas las de confianza alta" aplica las propuestas high confidence en lote

### Asignación y trazabilidad
- [ ] Las coordenadas inferidas se guardan en la DB con `gps_source: 'inferred_name' | 'inferred_vision' | 'manual'`
- [ ] En el detalle de foto, las coordenadas inferidas muestran: "Ubicación inferida por IA · [explicación]" con un botón "Corregir"
- [ ] Las fotos que ya tenían GPS EXIF nunca se modifican
- [ ] Un botón "Quitar ubicación inferida" elimina las coordenadas y el flag

### Activación del proceso
- [ ] Botón "Inferir ubicaciones" en la ruta `/tools/geolocate` lanza el proceso en background
- [ ] El proceso es incremental: solo procesa eventos no procesados previamente (o que hayan cambiado)
- [ ] Indicador de progreso: "Analizando evento 12 de 47..."
- [ ] El proceso puede interrumpirse y retomarse sin perder las inferencias ya completadas

---

## API necesaria

### `POST /api/geolocate/infer`
Lanza el proceso de inferencia para todos los eventos sin GPS (o para un evento específico si se pasa `eventId`).

### `GET /api/geolocate/status`
`{ running, progress, total_events, inferred, pending_review }`

### `GET /api/geolocate/proposals`
Lista de propuestas pendientes de revisión del usuario.

```json
{
  "proposals": [
    {
      "event": "Viaje-Roma-2019",
      "event_id": "2019/Viaje-Roma-2019",
      "photo_count": 87,
      "duration_days": 4,
      "proposal": {
        "lat": 41.9028,
        "lon": 12.4964,
        "label": "Roma, Italia",
        "confidence": "high",
        "source": "inferred_name",
        "explanation": "Detectado 'Roma' en el nombre del evento. Geocodificado a Roma, Italia (OpenStreetMap)."
      }
    }
  ]
}
```

### `POST /api/geolocate/proposals/[eventId]/confirm`
`{ "lat": ..., "lon": ..., "overwrite_existing": false }` — aplica las coordenadas a todas las fotos del evento.

### `POST /api/geolocate/proposals/[eventId]/dismiss`
Descarta la propuesta.

### `PATCH /api/photos/[id]/location`
`{ "lat": ..., "lon": ..., "source": "manual" }` — corrección individual.

---

## Ruta y navegación

- Ruta principal: `/tools/geolocate`
- Acceso: sidebar → "Herramientas" → "Inferir ubicaciones"
- Banner en la vista del mapa cuando hay eventos sin GPS: "X eventos sin ubicación — ¿Inferir con IA?"
- Banner en la vista de un evento sin GPS: "Este evento no tiene ubicación — ¿Inferir?"

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/tools/geolocate/page.tsx` | Server component — lista de propuestas |
| `src/app/tools/geolocate/GeolocationClient.tsx` | Client — revisión, confirmación, mini-mapa de ajuste |
| `src/app/api/geolocate/infer/route.ts` | Lanza proceso de inferencia |
| `src/app/api/geolocate/status/route.ts` | Estado del proceso |
| `src/app/api/geolocate/proposals/route.ts` | Lista de propuestas pendientes |
| `src/app/api/geolocate/proposals/[eventId]/confirm/route.ts` | Confirmar propuesta |
| `src/app/api/geolocate/proposals/[eventId]/dismiss/route.ts` | Descartar propuesta |
| `src/app/api/photos/[id]/location/route.ts` | Corrección individual |
| `src/lib/geolocate/nameInference.ts` | Capa 1: extracción de topónimo + Nominatim |
| `src/lib/geolocate/visionInference.ts` | Capa 2: análisis visual + clustering |
| `src/lib/geolocate/tripAnalyzer.ts` | Lógica de duración de viaje y selección de muestra |
| `src/lib/db.ts` | Columna `gps_source TEXT DEFAULT 'exif'` en `photos`; tabla `geolocate_proposals` |
| `src/components/Sidebar.tsx` | Badge con número de eventos sin GPS pendientes |

---

## Notas técnicas

### Capa 1 — Geocodificación de nombre
- Nominatim tiene un rate limit de 1 req/segundo y requiere un `User-Agent` descriptivo en el header. Respetar el límite con un throttle: `await sleep(1100)` entre peticiones.
- El topónimo extraído por Ollama puede tener variaciones de idioma. Si la primera búsqueda en Nominatim falla, reintentar con el topónimo en inglés usando Ollama: `"Translate this place name to English: {topónimo}"`.
- Los resultados de Nominatim se cachean en la tabla `geolocate_proposals` para no repetir la petición si el usuario relanza el proceso.

### Capa 2 — Inferencia visual
- La selección de fotos de muestra no es aleatoria: se seleccionan de forma uniforme en el tiempo del evento. Para 6 fotos de un evento de 5 días: fotos de las horas 0, 20, 40, 60, 80, 100 del porcentaje del rango temporal.
- El prompt de Ollama debe producir una respuesta estructurada. Usar `format: "json"` si el modelo lo soporta, o un template con marcadores: `País: [X] | Región: [Y] | Certeza: [alta/media/baja]`.
- El clustering de respuestas: si ≥ 2/3 de las fotos de la muestra mencionan el mismo país → mismo cluster. Si hay split: presentar los dos clusters como opciones al usuario.
- Para eventos > 14 días: procesar la inferencia por semanas (días 1–7, 8–14...) y presentar sub-propuestas separadas.

### Base de datos
- Nueva tabla `geolocate_proposals`: `event_id TEXT, lat REAL, lon REAL, label TEXT, confidence TEXT, source TEXT, explanation TEXT, status TEXT DEFAULT 'pending', created_at, reviewed_at`
- El `event_id` usa el mismo formato compuesto que el resto del sistema: `year/event_name`.

---

## Fuera de alcance (v1)

- Aplicación automática sin revisión del usuario (incluso para confianza alta)
- Inferencia por tracks GPX externos
- Subdivisión automática de eventos largos en sub-ubicaciones sin intervención del usuario
- Geocodificación inversa (coords → nombre de lugar legible) para las fotos que ya tienen GPS
- Soporte para APIs de geocodificación de pago (Google Maps, Mapbox)
- Sincronización de las coordenadas inferidas al EXIF del archivo original
