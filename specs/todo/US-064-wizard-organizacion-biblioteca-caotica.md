# Feature: Wizard de organización para biblioteca caótica

## Historia de usuario

Como fotógrafo amateur que tiene años de fotos sin organizar y no sabe por dónde empezar,
quiero un asistente guiado que analice mi biblioteca y me proponga un plan paso a paso adaptado a mi situación real,
para empezar a organizar sin sentirme abrumado y ver progreso desde el primer día.

---

## Descripción

"Es demasiado tarde, tengo demasiadas fotos" — esta es la excusa número uno que paraliza al fotógrafo amateur con una biblioteca caótica. Ninguna herramienta del mercado resuelve esto bien porque todas asumen que el usuario ya quiere organizar. El verdadero problema es la motivación inicial: el usuario no sabe por dónde empezar ni cuánto tiempo le va a llevar.

Este wizard analiza la biblioteca del usuario y genera un **plan de organización personalizado** dividido en sesiones de trabajo cortas y concretas (30 minutos por sesión). El plan es adaptativo: si el usuario tiene 50.000 fotos sin tags pero un 90% de cobertura GPS, el plan prioriza el tagging y omite el geotag.

El wizard tiene tres fases:
1. **Diagnóstico**: analiza la biblioteca y calcula métricas de caos (misma data que el dashboard de salud)
2. **Plan**: propone entre 3 y 10 "misiones" ordenadas por impacto/esfuerzo, con estimación de tiempo
3. **Ejecución**: lleva al usuario directamente a la herramienta correspondiente para cada misión, con seguimiento del progreso

---

## Criterios de aceptación

### Fase 1 — Diagnóstico
- [ ] El wizard arranca con una pantalla de bienvenida: "Analicemos tu biblioteca para ver por dónde empezar"
- [ ] Se ejecuta el diagnóstico de salud (mismas queries que US-061) con una animación de progreso
- [ ] El resultado se presenta con lenguaje humano: "Tienes 12.400 fotos. Unas 4.000 no están clasificadas, lo que dificulta encontrarlas. Hay 34 grupos de fotos duplicadas que ocupan 2.3 GB."
- [ ] Tiempo de diagnóstico: < 5 segundos para la mayoría de bibliotecas

### Fase 2 — Plan
- [ ] Se generan entre 3 y 8 "misiones", ordenadas por impacto descendente
- [ ] Cada misión incluye:
  - Título: "Clasifica 200 fotos con IA" o "Elimina duplicados obvios (34 grupos)"
  - Descripción del problema que resuelve
  - Tiempo estimado: "~15 minutos" o "~2 horas"
  - Dificultad: fácil / media / requiere tiempo
  - Tipo de acción: automática (la app lo hace sola) vs. manual (el usuario toma decisiones)
- [ ] Las misiones "automáticas" (clasificar con IA, lanzar scan) tienen un botón "Hacer ahora" que las ejecuta sin salir del wizard
- [ ] Las misiones "manuales" (revisar duplicados, añadir ubicaciones) tienen un botón "Empezar" que lleva a la herramienta correspondiente

### Catálogo de misiones posibles
- [ ] "Escanear fotos no indexadas" (si cobertura de indexación < 100%)
- [ ] "Clasificar fotos sin tags con IA" (si % clasificadas < 80%)
- [ ] "Revisar X grupos de duplicados" (si hay duplicados pendientes)
- [ ] "Añadir ubicación a Y eventos" (si hay eventos completos sin GPS)
- [ ] "Revisar X tags IA de baja confianza" (si hay tags pendientes de validación)
- [ ] "Gestionar pares RAW+JPEG" (si hay pares detectados)
- [ ] "Verificar integridad de archivos" (siempre disponible si no se ha hecho nunca)

### Fase 3 — Seguimiento
- [ ] Cuando el usuario completa una misión (o vuelve al wizard), la misión se marca como completada
- [ ] El progreso global se muestra: "3 de 7 misiones completadas · Biblioteca al 68% de salud"
- [ ] El wizard puede reopenarse desde el sidebar para ver el estado actualizado del plan
- [ ] Si se completan todas las misiones: pantalla de celebración con el score de salud final

---

## API necesaria

Reutiliza la API de `/api/health` (US-061) para el diagnóstico. Las acciones del wizard usan las APIs existentes de cada herramienta.

### `GET /api/wizard/plan`
Genera el plan de misiones basado en el estado actual de la biblioteca.

### `PATCH /api/wizard/missions/[id]`
`{ "completed": true }` — marca una misión como completada.

---

## Ruta y navegación

- Ruta: `/wizard`
- Primera vez: aparece un banner en la biblioteca principal: "¿Quieres organizar tu biblioteca? Te ayudamos a empezar →"
- Acceso recurrente: sidebar → "Plan de organización" con badge de progreso (3/7)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/wizard/page.tsx` | Server component — estado del wizard |
| `src/app/wizard/WizardClient.tsx` | Client — las tres fases con transiciones |
| `src/app/wizard/DiagnosisStep.tsx` | Fase 1: animación + resultado del diagnóstico |
| `src/app/wizard/PlanStep.tsx` | Fase 2: lista de misiones con estimaciones |
| `src/app/wizard/MissionCard.tsx` | Tarjeta individual de misión |
| `src/app/api/wizard/plan/route.ts` | Genera misiones priorizadas |
| `src/app/api/wizard/missions/[id]/route.ts` | Marcar misión completada |
| `src/lib/queries/wizard.ts` | Lógica de priorización de misiones |
| `src/lib/db.ts` | Tabla `wizard_missions (id, title, type, completed_at)` |
| `src/components/Sidebar.tsx` | Entrada "Plan de organización" con badge |

---

## Notas técnicas

- El plan de misiones se genera server-side en `generateWizardPlan(healthMetrics)`: una función que evalúa cada dimensión del health y añade la misión correspondiente si supera un umbral de "problema". El orden es por `(impacto_en_score * peso) / tiempo_estimado_horas` — las acciones automáticas rápidas siempre van primero.
- Las estimaciones de tiempo son heurísticas basadas en el volumen: clasificar con IA = n_fotos_sin_tags * 3 segundos por foto (tiempo de Ollama estimado); revisar duplicados = n_grupos * 30 segundos.
- La persistencia del wizard en la DB es mínima: solo qué misiones están completadas y la fecha. El plan se regenera en cada visita con el estado actual de la biblioteca.

---

## Fuera de alcance (v1)

- Wizard con entrevista al usuario (¿qué tipo de fotógrafo eres? ¿qué usas más la app?)
- Misiones gamificadas con puntos o badges
- Modo "sesión de 30 minutos" con timer incorporado
- Acceso desde app móvil
