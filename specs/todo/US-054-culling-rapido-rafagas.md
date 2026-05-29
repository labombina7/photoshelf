# Feature: Culling rápido de ráfagas

## Historia de usuario

Como fotógrafo semi-profesional que dispara en ráfaga en eventos y bodas,
quiero agrupar automáticamente los disparos similares y poder elegir el mejor de cada serie con atajos de teclado,
para reducir de horas a minutos la selección post-sesión sin revisar foto a foto.

---

## Descripción

Después de una sesión intensa (una boda, un concierto, un partido), el fotógrafo puede tener cientos de ráfagas de 5–20 disparos prácticamente idénticos. Revisarlos uno a uno en la biblioteca normal es agotador y lento — es el "decision fatigue" que describe el 80% de fotógrafos semi-profesionales como su mayor fricción post-sesión.

El modo culling agrupa automáticamente los disparos que ocurrieron dentro de un mismo evento y con menos de N segundos de diferencia entre sí (umbral configurable, por defecto 3 segundos). Para cada grupo, muestra las fotos en una vista horizontal tipo carrusel y permite navegar con teclado: elegir la mejor (Enter), descartarla como no favorita (X), o saltarla (→) sin tomar decisión.

El resultado del culling es una colección de "elegidas" que el usuario puede revisar después, exportar, o usar como base para un álbum.

Este flujo no borra nada — solo aplica el rating "favorita" o un tag especial `culled:yes` / `culled:skip` a cada foto. El usuario mantiene control total.

---

## Criterios de aceptación

### Agrupación de ráfagas
- [ ] El sistema detecta automáticamente grupos de fotos del mismo evento con diferencia de `taken_at` ≤ umbral (por defecto 3 seg)
- [ ] Si no hay datos EXIF de fecha, se usa el `created_at` del archivo
- [ ] Los grupos se presentan ordenados por evento y hora
- [ ] El umbral de segundos es configurable en la UI del modo culling (1, 3, 5, 10 segundos)
- [ ] Solo se muestran grupos con ≥ 2 fotos — las fotos aisladas no aparecen en culling

### Interfaz de culling
- [ ] El modo culling es accesible desde la vista de un evento (botón "Modo culling") y desde el sidebar general
- [ ] Vista horizontal de las fotos del grupo actual, con navegación entre grupos lateralmente
- [ ] Cada grupo muestra un contador "Grupo 7 de 34 · 5 fotos"
- [ ] El nombre del evento y la hora de captura se muestran como contexto
- [ ] Las fotos se muestran a tamaño adecuado para evaluar enfoque (no thumbnail pequeño)

### Atajos de teclado
- [ ] `Enter` o `F` — marca la foto actual como favorita y avanza a la siguiente foto del grupo
- [ ] `X` — descarta (sin marcar) y avanza
- [ ] `→` — avanza sin tomar decisión (skip)
- [ ] `←` — retrocede a la foto anterior del grupo
- [ ] `Tab` — salta al siguiente grupo sin resolver el actual
- [ ] `Escape` — sale del modo culling y vuelve al evento

### Resumen y resultado
- [ ] Al terminar, pantalla de resumen: "X fotos marcadas como favoritas de Y grupos revisados"
- [ ] Las fotos marcadas como favoritas son visibles en la biblioteca con el filtro "Favoritas" estándar
- [ ] El historial de sesiones de culling no se persiste (es un flujo one-shot)

---

## API necesaria

### `GET /api/photos/[eventId]/bursts`
Devuelve los grupos de ráfaga del evento.

```json
{
  "groups": [
    {
      "id": "burst_001",
      "photos": [
        { "id": 42, "taken_at": "2024-06-15T14:32:01Z", "filename": "..." }
      ],
      "startTime": "2024-06-15T14:32:01Z",
      "duration_seconds": 2.4
    }
  ],
  "total_groups": 34,
  "total_photos": 187
}
```

### `POST /api/photos/[photoId]/favorite`
Endpoint ya existente — reutilizar.

---

## Ruta y navegación

- Ruta: `/culling/[eventId]`
- Acceso: botón "Modo culling" en la topbar del evento (solo visible cuando el evento tiene ráfagas detectadas)
- Sin sidebar durante el culling — pantalla completa

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/culling/[eventId]/page.tsx` | Server component — carga grupos de ráfaga |
| `src/app/culling/[eventId]/CullingClient.tsx` | Client — navegación por teclado, estados de decisión |
| `src/app/api/photos/[eventId]/bursts/route.ts` | Nuevo — detección de grupos por timestamp |
| `src/lib/queries/bursts.ts` | Lógica de agrupación temporal en SQLite |
| `src/app/(library)/[year]/[event]/page.tsx` | Añadir botón "Modo culling" si hay ráfagas |

---

## Notas técnicas

- La query de agrupación usa una window function de SQLite: `LAG(taken_at)` para calcular diferencias entre fotos consecutivas del evento, ordenadas por `taken_at ASC`
- Los grupos se calculan on-demand — no se persisten en la DB (se recomputan en cada sesión de culling)
- El tamaño de imagen para culling usa el thumbnail `size=1200` ya disponible en `/api/photos/[id]/thumbnail?size=1200`
- El modo culling no necesita Ollama — es puramente basado en metadatos EXIF

---

## Fuera de alcance (v1)

- Culling global de toda la biblioteca (no solo por evento)
- Sugerencia automática del "mejor" frame de cada ráfaga por IA
- Comparación side-by-side dentro del culling (eso es US-049)
- Ráfagas detectadas por movimiento/blur en lugar de timestamp
- Historial de sesiones de culling persisitido
