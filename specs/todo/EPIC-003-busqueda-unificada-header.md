# EPIC-003: Búsqueda unificada en el header

> **Estado: 🗂 Planificada**

---

## Visión general

Hoy photoshelf tiene dos mecanismos de búsqueda desconectados: un filtro de texto en la biblioteca (`/library`) y un panel lateral de búsqueda IA (`AISearchPanel`) accesible desde el botón "Buscar" con icono de estrella en el sidebar. El usuario no tiene un punto de entrada unificado, y los resultados de la búsqueda IA aparecen en un panel flotante en lugar del área principal.

Esta épica unifica toda la búsqueda en **una sola barra centrada en el header** que:
- Es visible desde cualquier vista de la app
- Soporta búsqueda keyword (fotos, tags, eventos, proyectos) y búsqueda IA en lenguaje natural
- Decide automáticamente qué tipo de búsqueda ejecutar mediante un clasificador heurístico — **sin llamar a Ollama salvo cuando es realmente necesario**
- Muestra los resultados en el área principal de la app (`/search`), no en un panel flotante
- Marca visualmente cuándo la búsqueda ha sido procesada por IA

El resultado es una búsqueda predecible, rápida y coherente para el usuario.

---

## Motivación

| Problema actual | Impacto |
|---|---|
| Dos entradas de búsqueda separadas (filtro biblioteca + panel IA) | El usuario no sabe cuál usar ni qué busca cada una |
| Búsqueda IA siempre llama a Ollama, aunque la consulta sea un tag simple | Latencia innecesaria (2-8s) para búsquedas triviales |
| Resultados de búsqueda IA en panel flotante, no en área principal | No hay URL compartible, no funciona el botón atrás |
| El botón "Buscar" solo existe en el sidebar, invisible desde el mapa o el timeline | La búsqueda IA no es accesible desde todas las vistas |

---

## Historias hijas

| ID | Título | Esfuerzo | Dependencias |
|----|--------|----------|--------------|
| [US-028](US-028-shell-barra-busqueda-header.md) | Shell de la barra de búsqueda en el header | M | — |
| [US-029](US-029-clasificador-intencion-busqueda.md) | Clasificador de intención de búsqueda (sin Ollama) | S | — |
| [US-030](US-030-api-busqueda-unificada.md) | API de búsqueda unificada (`/api/search`) | M | US-029 |
| [US-031](US-031-pagina-resultados-busqueda.md) | Página de resultados `/search` en el área principal | M | US-028, US-030 |
| [US-032](US-032-busqueda-ia-indicador-visual.md) | Búsqueda IA con indicador visual y resultados en área principal | M | US-031 |
| [US-033](US-033-historial-sugerencias-busqueda.md) | Historial de búsquedas y sugerencias autocomplete | S | US-028 |
| [US-034](US-034-retirar-panel-busqueda-antiguo.md) | Retirar AISearchPanel y botón Buscar del sidebar | S | US-031, US-032 |

---

## Orden de ejecución recomendado

```
US-029 (clasificador) ──► US-030 (API) ──┐
US-028 (shell UI)     ──────────────────►├──► US-031 (página resultados)
                                         └──► US-032 (búsqueda IA)
                                                       ↓
                                              US-033 (sugerencias)
                                              US-034 (cleanup)
```

**Fase 1 — Infraestructura invisible**: US-029 + US-030. El clasificador y la API funcionan pero no hay UI nueva todavía.

**Fase 2 — UI**: US-028 + US-031. La barra aparece en el header, los resultados van a `/search`.

**Fase 3 — IA y calidad**: US-032 + US-033. Búsqueda IA integrada, historial y autocomplete.

**Fase 4 — Cleanup**: US-034. Eliminar código antiguo una vez todo validado.

---

## Clasificador de intención (diseño)

El clasificador es la pieza clave para no llamar a Ollama innecesariamente. Es puro código JS, sin API externa:

```
Texto del usuario
   ↓
Clasificador heurístico (síncrono, < 1ms)
   ├── Solo dígitos (4) ────────────────────── → YEAR (ej: "2022")
   ├── Coincide exacto con tag existente ────── → TAG
   ├── Coincide con nombre de evento ────────── → EVENT
   ├── ≥ 4 palabras con verbo/adjetivo ─────── → AI_SEARCH
   ├── Contiene "?" o "¿" ─────────────────── → AI_SEARCH
   └── Resto (keyword corta, nombre de archivo)→ FULLTEXT
                           ↓
               ¿AI_SEARCH? → llama a Ollama
               ¿Resto?     → SQL directo, < 100ms
```

La lista de tags y eventos se carga una vez al iniciar la sesión y se cachea en memoria del cliente.

---

## Diseño de la URL de resultados

```
/search?q=bodas+en+la+playa           → búsqueda keyword o IA (el clasificador decide)
/search?q=naturaleza&mode=ai          → forzar modo IA
/search?q=verano&type=tags            → forzar búsqueda en tags
```

Los resultados son accesibles, compartibles y navegables con el botón atrás del navegador.

---

## Fuera de alcance (v1)

- Búsqueda federada entre catálogos (buscar en todos los catálogos a la vez)
- Búsqueda por similitud visual (embeddings de imágenes)
- Filtros avanzados en la UI de resultados (fecha exacta, cámara, ISO…)
- Búsqueda por voz
- Indexación full-text con FTS5 de SQLite (mejora de rendimiento futura)
- Resultados en tiempo real mientras se escribe (typeahead completo con fotos)
