# US-030: API de búsqueda unificada (`/api/search`)

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** M
> **Dependencias:** US-029

---

## Historia

**Como** cliente de la API (web o futuro cliente iOS),  
**quiero** un único endpoint de búsqueda que maneje todos los tipos de consulta,  
**para** no tener que saber de antemano si la búsqueda es por tag, evento, año o requiere IA.

---

## Contexto

Actualmente existe `/api/ai/search` que solo maneja búsquedas IA. La búsqueda por texto en la biblioteca se hace directamente en el Server Component de `/library` con SQL inline. No hay ningún endpoint unificado que el header pueda llamar.

Esta US crea `GET /api/search?q=...` que usa el clasificador de US-029 para decidir la estrategia y devuelve resultados en un formato unificado.

---

## Criterios de aceptación

### Endpoint

- [ ] `GET /api/search?q={query}&catalog={id}` existe en `src/app/api/search/route.ts`
- [ ] El parámetro `catalog` es opcional (default: catálogo activo en sesión)
- [ ] Requiere sesión autenticada; devuelve 401 si no autenticado

### Clasificación y routing

- [ ] El endpoint usa `classifyQuery` de US-029 para determinar el intent
- [ ] Carga los hints (tags y eventos del catálogo activo) de la BD para pasarlos al clasificador
- [ ] Según el intent, ejecuta la estrategia correspondiente:

  | Intent | Estrategia | Latencia objetivo |
  |---|---|---|
  | `year` | `SELECT * FROM photos WHERE year = ?` | < 50ms |
  | `tag` | JOIN con `photo_tags` y `tags` | < 50ms |
  | `event` | `SELECT * FROM photos WHERE event LIKE ?` | < 50ms |
  | `fulltext` | LIKE sobre `filename`, `event`, `path` | < 100ms |
  | `ai` | Llama a `parseSearchQuery` de Ollama + búsqueda por tags | 1-5s |

### Respuesta

- [ ] La respuesta sigue el envelope estándar de EPIC-002/US-023:

  ```json
  {
    "data": {
      "intent": "tag",
      "query": "boda",
      "isAI": false,
      "photos": [
        { "id": 1, "filename": "...", "year": 2023, "event": "...", "is_favorite": false }
      ],
      "total": 42,
      "tags": [],
      "events": []
    },
    "meta": { "duration_ms": 23 }
  }
  ```

- [ ] El campo `intent` refleja el tipo clasificado (`year`, `tag`, `event`, `fulltext`, `ai`)
- [ ] El campo `isAI` es `true` solo cuando se ha llamado a Ollama
- [ ] `photos` contiene hasta 200 resultados (no paginados en v1)
- [ ] `tags` lista los tags que coincidan con la query (para intent `fulltext` o `ai`)
- [ ] `events` lista los eventos que coincidan con la query
- [ ] El campo `meta.duration_ms` registra el tiempo total del endpoint

### Casos edge

- [ ] Query vacía → 400 Bad Request
- [ ] Query > 200 caracteres → se trunca a 200 (igual que el endpoint actual)
- [ ] Ollama no disponible en búsqueda IA → devuelve 503 con mensaje claro (no 500)
- [ ] Resultados vacíos → 200 con `data.photos = []`, no 404

---

## Notas técnicas

- El endpoint es `GET` (no `POST`) para que la URL sea bookmarkable y compatible con el historial del navegador
- La lógica SQL de búsqueda se extrae a `src/lib/queries/search.ts` (siguiendo el patrón de capa de repositorio de US-022)
- Para la búsqueda IA, reutiliza `parseSearchQuery` del módulo `src/lib/ollama.ts` existente — no duplicar lógica
- En modo `fulltext`, buscar también en `tags.name` para que "familia" encuentre fotos etiquetadas con ese tag aunque el clasificador no lo detecte como intent `tag`
- Añadir el endpoint al catálogo de contratos de EPIC-002 (US-023)

---

## Fuera de alcance

- Paginación (v1: máximo 200 resultados)
- Búsqueda `deep` (análisis visual foto a foto con Ollama) — eso se mantiene como opción en la página de resultados (US-032)
- Filtros por fecha exacta, cámara, etc.
- Búsqueda cross-catálogo
