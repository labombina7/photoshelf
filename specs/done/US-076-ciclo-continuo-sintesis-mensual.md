# US-076: Ciclo continuo — análisis diario y síntesis mensual/anual

> **Épica padre:** [EPIC-004 — Análisis de estilo fotográfico](EPIC-004-analisis-estilo-fotografico.md)
> **Depende de:** US-074, US-075

> Estado: ✅ Desplegada

## Historia de usuario

Como fotógrafo que usa photoshelf regularmente,
quiero que el análisis de mi estilo se actualice solo en background a medida que añado fotos y pasan los meses,
para que los insights siempre reflejen mi evolución más reciente sin que yo tenga que hacer nada.

---

## Descripción

Una vez completado el bootstrap (US-075), el sistema necesita mantenerse vivo. Esta US implementa los tres ritmos del ciclo continuo:

**Diario** — cada día, las fotos que han entrado al catálogo desde la última ejecución se incorporan al perfil del mes en curso. No llama a Ollama — solo acumula señales EXIF y tags para que el cierre de mes tenga material fresco.

**Mensual (cierre de mes)** — el día 1 de cada mes, Ollama sintetiza el mes que acaba de cerrar y lo compara con el mes anterior para generar la narrativa de evolución: qué ha cambiado, hacia dónde va el estilo, qué equipo ha ganado presencia.

**Anual** — el 1 de enero, Ollama regenera el perfil histórico de largo plazo (Bloque 1) incorporando el año que acaba de cerrar. Es la única operación que toca el Bloque 1 después del bootstrap.

Esta US también implementa el prompt de Ollama para la síntesis — tanto el de cierre mensual como el de regeneración anual.

---

## Criterios de aceptación

### Tabla de perfiles sintetizados

- [ ] Se crea la tabla `style_profiles` con: `id`, `period` (YYYY-MM o YYYY), `type` ('monthly' | 'annual_historical'), `profile_text` (texto narrativo generado por Ollama), `period_summary` (JSON con señales EXIF agregadas del periodo), `created_at`, `updated_at`
- [ ] Se crea la migración correspondiente
- [ ] `getStyleProfile(period)` devuelve el perfil de un periodo dado — usado por la UI (US-077)
- [ ] `getLatestProfiles(n)` devuelve los N perfiles mensuales más recientes — para el Bloque 2 de la UI

### Ciclo diario

- [ ] `runDailyCycle()` en `src/lib/style-analysis/cycle.ts` se ejecuta una vez al día (integrado en el scheduler de background)
- [ ] Detecta las fotos nuevas desde `last_daily_run` y acumula sus señales EXIF en una tabla intermedia `style_pending_signals`
- [ ] No llama a Ollama — es solo acumulación de datos
- [ ] Actualiza `last_daily_run` en la configuración del sistema

### Cierre mensual

- [ ] `runMonthlySynthesis(month: string)` se ejecuta el día 1 de cada mes para el mes anterior (formato: `YYYY-MM`)
- [ ] Recoge las señales acumuladas en `style_pending_signals` para ese mes + las de la muestra de fotos del mes (via US-074)
- [ ] Construye el prompt de Ollama con: resumen de señales EXIF del mes, tags predominantes, perfil del mes anterior (para comparación), e instrucción de generar narrativa de evolución
- [ ] Ollama devuelve texto narrativo en español que incluye: qué géneros has practicado, qué equipo has usado, qué ha cambiado respecto al mes anterior, y 1-2 observaciones de tendencia
- [ ] El resultado se persiste en `style_profiles` con `type: 'monthly'`
- [ ] Si Ollama no está disponible, reintenta al día siguiente (no bloquea)

### Regeneración anual

- [ ] `runAnnualSynthesis(year: number)` se ejecuta el 1 de enero para el año anterior
- [ ] Recoge los 12 perfiles mensuales del año cerrado y los envía a Ollama como contexto
- [ ] Ollama genera un relato narrativo del año: qué definió ese año fotográficamente, cómo evolucionó el estilo a lo largo del año, qué equipo marcó ese periodo
- [ ] El resultado se persiste en `style_profiles` con `type: 'annual_historical'`
- [ ] El perfil anual reemplaza (upsert) cualquier perfil previo del mismo año

### Prompt de síntesis mensual

- [ ] El prompt incluye: señales EXIF del mes (distribución de focales, apertura media, ISO medio, hora media, equipo predominante, géneros), los 10 tags más frecuentes del mes, y el texto del perfil del mes anterior
- [ ] Instrucción explícita: responder en español, en tono personal dirigido al fotógrafo ("este mes has...", "se nota que..."), en 3-5 párrafos
- [ ] El JSON de respuesta tiene los campos: `narrative` (texto libre), `highlights` (array de 2-3 observaciones clave), `trend` (una frase sobre la dirección del estilo)

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/style-analysis/cycle.ts` | Nuevo — lógica del ciclo continuo (diario, mensual, anual) |
| `src/lib/style-analysis/prompts.ts` | Nuevo — prompts de Ollama para síntesis mensual y anual |
| `src/lib/queries/style-analysis.ts` | Ampliar con `getStyleProfile`, `getLatestProfiles`, gestión de `style_pending_signals` |
| `src/lib/types.ts` | Añadir `StyleProfile` |
| `migrations/` | Migración para `style_profiles` y `style_pending_signals` |

---

## Notas técnicas

- El cierre mensual corre el día 1 de cada mes, pero si la app no estaba activa ese día, debe ejecutarse la próxima vez que arranque y detecte que hay meses sin síntesis
- La comparación con el mes anterior es la clave de la narrativa de evolución — si no hay perfil previo (primer mes), Ollama genera el perfil sin comparación
- El prompt de síntesis anual recibe los 12 textos narrativos mensuales concatenados — vigilar el tamaño del contexto con catálogos muy activos; si supera el límite, resumir a los highlights de cada mes
- `style_pending_signals` actúa como buffer temporal: se vacía cuando el cierre mensual consume esos datos

---

## Fuera de alcance

- UI de los insights (eso es US-077)
- Configuración del idioma de la narrativa (español fijo en v1)
- Notificaciones al usuario cuando el perfil mensual está listo
