# US-029: Clasificador de intención de búsqueda (sin Ollama)

> **Estado: ⬜ Pendiente**
> **Épica:** [EPIC-003](EPIC-003-busqueda-unificada-header.md)
> **Esfuerzo:** S
> **Dependencias:** —

---

## Historia

**Como** desarrollador de photoshelf,  
**quiero** un clasificador de intención que decida el tipo de búsqueda antes de ejecutarla,  
**para** evitar llamadas innecesarias a Ollama en búsquedas simples y mantener la latencia por debajo de 100ms en el caso común.

---

## Contexto

El actual `AISearchPanel` llama siempre a `/api/ai/search`, que a su vez llama a `parseSearchQuery` de Ollama para extraer concepto, año y tags. Esto añade 1-3s de latencia incluso cuando el usuario escribe simplemente "verano" o "2022" — búsquedas que podrían resolverse con SQL directo en < 20ms.

El clasificador es la pieza clave de EPIC-003: decide el tipo de búsqueda en el cliente (o en el servidor como módulo compartido) antes de hacer ninguna llamada a Ollama.

---

## Criterios de aceptación

- [ ] Existe el módulo `src/lib/search/classifier.ts` con una función `classifyQuery(query: string, hints: ClassifierHints): SearchIntent`
- [ ] `SearchIntent` es un tipo discriminado con los siguientes valores:

  ```ts
  type SearchIntent =
    | { type: 'year';     year: number }
    | { type: 'tag';      name: string }
    | { type: 'event';    name: string }
    | { type: 'fulltext'; query: string }
    | { type: 'ai';       query: string }
  ```

- [ ] `ClassifierHints` contiene las listas de tags y eventos conocidos (se pasan desde el cliente para evitar queries adicionales)
- [ ] Las reglas de clasificación, en orden de prioridad:

  | Condición | Intent resultante |
  |---|---|
  | Query es exactamente 4 dígitos numéricos | `year` |
  | Query (normalizada) coincide exactamente con un tag conocido | `tag` |
  | Query (normalizada) coincide con un nombre de evento conocido | `event` |
  | Query contiene `?` o `¿` | `ai` |
  | Query tiene ≥ 4 palabras | `ai` |
  | Query contiene al menos un token de la lista de palabras descriptivas (colores, emociones, escenas) | `ai` |
  | Resto | `fulltext` |

- [ ] La lista de "palabras descriptivas" que fuerzan `ai` está definida como constante en el módulo (30-50 palabras: colores, emociones, escenas, adjetivos frecuentes en fotografía)
- [ ] La normalización es: trim + lowercase + quitar acentos (sin dependencias externas)
- [ ] El módulo tiene tests unitarios en `src/lib/search/classifier.test.ts` con al menos 15 casos cubriendo cada rama
- [ ] La función es síncrona y no hace ninguna llamada de red

---

## Ejemplos de clasificación

| Query | Intent |
|---|---|
| `2022` | `year: 2022` |
| `boda` | `tag: "boda"` (si "boda" existe como tag) |
| `verano en la playa al atardecer` | `ai` (≥ 4 palabras) |
| `¿dónde están mis fotos de montaña?` | `ai` (contiene `¿`) |
| `retrato íntimo` | `ai` ("íntimo" es palabra descriptiva) |
| `familia` | `fulltext` (si "familia" no es un tag conocido) |
| `IMG_4532` | `fulltext` |
| `Navidad 2023` | `ai` (≥ 2 palabras, "navidad" puede ser descriptiva — o evaluar como fulltext si los eventos lo cubren) |

---

## Notas técnicas

- El módulo es puro TypeScript sin dependencias externas — importable tanto en el cliente como en el servidor (sin `'use client'` ni `'use server'`)
- Los hints de tags y eventos los provee el llamante. En el servidor (`/api/search/route.ts`) se obtienen de la BD; en el cliente se obtienen de un endpoint ligero o del contexto de la app
- No usar `Intl.Collator` para la normalización de acentos por compatibilidad — usar un simple map de caracteres acentuados a sus equivalentes ASCII
- La lista de palabras descriptivas puede ampliarse sin cambiar la firma del módulo

---

## Fuera de alcance

- Clasificación basada en embeddings o ML (v2)
- Aprendizaje de los patrones de búsqueda del usuario
- Clasificación de queries en otros idiomas (v1 asume español)
