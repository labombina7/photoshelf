# Épica: Análisis de estilo fotográfico

> **Estado: ✅ Desplegada**

---

## Visión general

Photoshelf tiene acceso a todo el catálogo del fotógrafo — fotos, metadatos EXIF, tags generados por IA y estructura temporal. Sin embargo, hoy toda esa información vive en silos: el usuario puede buscar y explorar, pero nadie le devuelve una lectura de sí mismo como fotógrafo.

Esta épica añade una capa de **inteligencia reflexiva** que analiza el catálogo en background y genera insights sobre el estilo visual del fotógrafo: qué géneros practica, qué equipo prefiere, cómo dispara, cómo ha evolucionado y hacia dónde parece ir. El análisis combina datos cuantitativos (EXIF: focal, apertura, ISO, hora, cámara, objetivo) con análisis cualitativo de las imágenes via Ollama, sintetizados en lenguaje natural.

El resultado es una **vista de insights** integrada en el sidebar, con dos bloques diferenciados:

1. **Historia fotográfica** — relato de largo plazo: qué hacías en cada época, cómo fue evolucionando la mirada a lo largo de los años.
2. **Evolución reciente** — análisis de los últimos 24 meses: tendencias activas, equipo usado, dirección del estilo y consejos de mejora accionables.

Todo corre en background de forma automática, sin que el usuario tenga que hacer nada.

---

## Problema que resuelve

El fotógrafo tiene miles de fotos pero ningún espejo que le diga quién es visualmente. Las apps de galería muestran fotos; esta épica convierte ese catálogo en autoconocimiento fotográfico.

---

## Modelo de procesamiento (2 velocidades)

### Velocidad 1 — Bootstrap (se ejecuta una sola vez al activar la épica)

1. **Muestra histórica** (fotos anteriores a los últimos 24 meses): se selecciona una muestra representativa por año y por evento/carpeta. No se analiza todo — con 20-30 fotos bien distribuidas por año hay señal suficiente para el perfil de largo plazo.
2. **Análisis completo de los últimos 24 meses**: todas las fotos de este periodo se analizan para tener una base sólida de evolución reciente.

El bootstrap puede tardar varios días dependiendo del tamaño del catálogo. Corre en segundo plano con prioridad baja para no interferir con el uso normal de la app.

### Velocidad 2 — Ciclo continuo (corre indefinidamente)

- **Diario**: las fotos nuevas que entran al catálogo se analizan y se incorporan al perfil del mes en curso.
- **Mensual** (cierre de mes): Ollama sintetiza el mes completo, lo compara con el mes anterior y genera la narrativa de evolución. El perfil de los últimos 24 meses se actualiza.
- **Anual**: el Bloque 1 (historia fotográfica de largo plazo) se regenera para incorporar el año cerrado y refrescar el relato histórico.

---

## Fuentes de datos por foto

| Fuente | Campos usados |
|---|---|
| EXIF | Cámara, objetivo, focal length, apertura, ISO, velocidad obturación, hora del disparo, geolocalización (si existe) |
| Tags IA | Géneros, sujetos, composición, luz, paleta de color, mood |
| Estructura de carpetas | Agrupación por evento/proyecto — señal de curación implícita |
| Fecha | Para segmentación temporal mensual y anual |

---

## Vista de insights (UI)

Nueva entrada en el sidebar. Dos bloques:

### Bloque 1 — Tu historia fotográfica
- Relato cronológico de largo plazo generado por Ollama
- Organizado por épocas/años
- Se regenera anualmente
- Tono: narrativo, autobiográfico — "En tus inicios predominaba el paisaje con gran angular..."

### Bloque 2 — Tu evolución reciente (últimos 24 meses)
- Tendencias activas: géneros, luz, composición
- Equipo usado: cámara y objetivos predominantes, cambios detectados
- Dirección del estilo: hacia dónde apunta la evolución si la tendencia es clara
- Consejos de mejora: específicos al estilo actual, no genéricos
- Se actualiza mensualmente

### Extensión futura (fuera de alcance de esta épica)
- Recomendaciones de fotógrafos de referencia afines al estilo detectado
- Libros y recursos específicos al género/técnica predominante

---

## Estrategia de síntesis con Ollama

El catálogo puede tener miles de fotos — no es viable mandar todo a Ollama en un prompt. La síntesis se hace por capas:

1. Cada foto ya tiene tags/descripción de IA → material disponible sin coste adicional de visión
2. Se agrupan por mes/año y se selecciona una muestra representativa (ej. top 50 por variedad de tags)
3. Ollama sintetiza la muestra en un perfil del periodo
4. Para el cierre mensual: Ollama recibe el perfil del mes actual + el perfil del mes anterior → genera narrativa de evolución y delta de estilo

Este enfoque mantiene los prompts dentro de un tamaño manejable y el coste en tokens local es asumible.

---

## Historias hijas

| ID | Título | Dependencias | Estado |
|---|---|---|---|
| [US-074](US-074-motor-analisis-estilo-exif-muestra.md) | Motor de análisis — extracción EXIF + selección de muestra | — | ⬜ Pendiente |
| [US-075](US-075-bootstrap-analisis-catalogo.md) | Bootstrap — análisis inicial del catálogo en 2 velocidades | US-074 | ⬜ Pendiente |
| [US-076](US-076-ciclo-continuo-sintesis-mensual.md) | Ciclo continuo — análisis diario y síntesis mensual/anual | US-074, US-075 | ⬜ Pendiente |
| [US-077](US-077-vista-insights-estilo-fotografico.md) | Vista de insights — sidebar Bloque 1 + Bloque 2 | US-074, US-075, US-076 | ⬜ Pendiente |

## Orden de ejecución

```
US-074 ──► US-075 ──► US-076 ──► US-077
```

---

## Fuera de alcance de esta épica

- Recomendaciones de fotógrafos/libros/recursos externos (extensión futura del Bloque 2)
- Comparación con otros usuarios o benchmarks externos
- Análisis en tiempo real al importar fotos (el ciclo diario es suficiente)
- Exportar el informe de estilo como PDF u otro formato
