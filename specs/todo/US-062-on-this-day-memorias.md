# Feature: "On This Day" — Memorias del pasado

## Historia de usuario

Como fotógrafo amateur que tiene fotos de varios años,
quiero que photoshelf me muestre cada día las fotos que tomé un día como hoy en años anteriores,
para redescubrir momentos olvidados y sentir que mi biblioteca tiene vida propia.

---

## Descripción

"On This Day" es la feature que convierte una biblioteca estática en algo que el usuario quiere visitar cada día. Google Photos y Apple Photos la tienen y es consistentemente una de las más valoradas — pero solo funciona si tus fotos están en su nube. photoshelf puede ofrecer exactamente lo mismo, con total privacidad y de forma local.

Cada vez que el usuario abre photoshelf, si hay fotos tomadas en la misma fecha (día y mes) en años anteriores, aparece un banner o sección prominente: "Hace 3 años, 5 años y 8 años — 14 fotos". Al pulsar, se abre una vista especial con las fotos agrupadas por año, permitiendo revivir esos momentos.

Además, si Ollama está configurado, se puede añadir una breve "narrativa del día": una frase generada que contextualiza el conjunto ("En junio de 2021 visitaste Barcelona y estuviste en un festival de música").

---

## Criterios de aceptación

### Banner en la página principal
- [ ] Si hay fotos con `taken_at` que coinciden con el mes y día actuales (ignorando el año), aparece un banner en la página de biblioteca
- [ ] El banner muestra: miniaturas de las fotos (máximo 5), los años en que hay fotos, y el total de fotos
- [ ] El banner solo aparece si hay fotos en al menos 1 año anterior (no el año actual)
- [ ] El banner se puede descartar con una X — la preferencia se guarda en localStorage
- [ ] Si no hay fotos para ese día, no aparece ningún banner

### Página de memorias del día
- [ ] Ruta: `/memories/today`
- [ ] Las fotos se agrupan por año: "2021 · 5 fotos", "2019 · 3 fotos"
- [ ] Dentro de cada año, las fotos se muestran en grid normal con las mismas opciones que la biblioteca
- [ ] La URL puede incluir una fecha específica: `/memories?date=06-15` para revisitar cualquier día del año

### Navegación temporal
- [ ] En la página de memorias, flechas `←` `→` para explorar el día anterior y siguiente ("ayer hace X años", "mañana hace X años")
- [ ] Un calendario compacto muestra qué días del año tienen fotos — para elegir qué día explorar

### Narrativa IA (opcional, requiere Ollama)
- [ ] Si Ollama está configurado y hay ≥ 5 fotos para ese día, aparece un botón "Generar narrativa"
- [ ] La narrativa se genera a partir del evento, los tags, el lugar GPS (si existe) y el año
- [ ] La narrativa es breve (1–2 frases) y se guarda en la DB asociada a la fecha para no regenerarla

---

## API necesaria

### `GET /api/memories/today`
Devuelve fotos del mismo mes-día en años anteriores.

```json
{
  "date": "06-15",
  "years": [
    { "year": 2021, "count": 5, "photos": [...] },
    { "year": 2019, "count": 3, "photos": [...] }
  ],
  "total": 8
}
```

### `GET /api/memories?date=MM-DD`
Igual pero para cualquier fecha.

### `POST /api/memories/narrative`
Genera narrativa IA para un conjunto de fotos de una fecha. Body: `{ date: "MM-DD", year: number }`

---

## Ruta y navegación

- Banner en `/library` (la página principal)
- Ruta dedicada: `/memories/today`
- Acceso desde sidebar: entrada "Memorias" o "On this day" con icono de calendario

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/memories/page.tsx` | Página de memorias del día |
| `src/app/memories/MemoriesClient.tsx` | Client — grupos por año, navegación temporal |
| `src/app/memories/TodayBanner.tsx` | Banner para la página principal |
| `src/app/api/memories/route.ts` | Fotos del mismo día en otros años |
| `src/app/api/memories/narrative/route.ts` | Generación de narrativa IA |
| `src/app/(library)/page.tsx` | Integrar `TodayBanner` |
| `src/lib/queries/memories.ts` | Query `WHERE strftime('%m-%d', taken_at) = :date AND year < :current_year` |
| `src/components/Sidebar.tsx` | Entrada "Memorias" |

---

## Notas técnicas

- La query de SQLite para el banner: `SELECT * FROM photos WHERE strftime('%m-%d', taken_at) = strftime('%m-%d', 'now') AND strftime('%Y', taken_at) < strftime('%Y', 'now') ORDER BY taken_at DESC LIMIT 20` — rápida incluso sin índice especial.
- El banner se carga como un Server Component separado (no bloquea el render de la biblioteca principal).
- La narrativa IA: prompt con "Dado que estas fotos de [evento] con tags [X, Y] fueron tomadas en [lugar] en [año], escribe una frase evocadora en primera persona sobre ese momento. Máximo 2 frases."

---

## Fuera de alcance (v1)

- Notificaciones push móviles "tienes memorias de hoy"
- Compartir memorias como collage o video (slideshow)
- Memorias semanales o mensuales (no solo el día exacto)
- Selección de la "foto del día" por IA
