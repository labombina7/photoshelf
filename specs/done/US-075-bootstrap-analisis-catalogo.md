# US-075: Bootstrap — análisis inicial del catálogo en 2 velocidades

> **Épica padre:** [EPIC-004 — Análisis de estilo fotográfico](EPIC-004-analisis-estilo-fotografico.md)
> **Depende de:** US-074

> Estado: ✅ Desplegada

## Historia de usuario

Como fotógrafo que acaba de activar el análisis de estilo,
quiero que la app analice mi catálogo histórico de forma progresiva y sin bloquear la app,
para tener un perfil inicial de estilo en pocos días sin que yo tenga que hacer nada.

---

## Descripción

El bootstrap es el proceso de arranque que se ejecuta una única vez cuando la épica se activa por primera vez. Su objetivo es construir el perfil inicial a partir del catálogo existente, que puede tener años de fotos.

Funciona en 2 velocidades:

**Velocidad rápida — muestra histórica (pre-24 meses)**
Analiza una muestra representativa de cada año anterior a los últimos 24 meses. No procesa foto a foto — coge 20-30 fotos por año bien distribuidas y genera un perfil de largo plazo. Resultado: la base del Bloque 1 (historia fotográfica).

**Velocidad completa — últimos 24 meses**
Analiza todas las fotos de los últimos 24 meses, mes a mes. Este es el material fresco sobre el que se detectará la evolución del estilo. Puede tardar varios días si hay muchas fotos. Corre en background con prioridad baja.

El bootstrap sabe dónde se quedó si la app se reinicia — es reanudable.

---

## Criterios de aceptación

### Tabla de estado del bootstrap

- [ ] Se crea la tabla `style_analysis_bootstrap` en SQLite con: `period` (YYYY o YYYY-MM), `type` ('historical_sample' | 'full'), `status` ('pending' | 'in_progress' | 'done'), `processed_at`, `photo_count`, `sample_count`
- [ ] Se crea la migración correspondiente
- [ ] Al arrancar el bootstrap por primera vez, se insertan todas las filas pendientes (años históricos + meses de los últimos 24 meses) en status `pending`

### Proceso de bootstrap

- [ ] `runBootstrap()` en `src/lib/style-analysis/bootstrap.ts` procesa las filas pendientes de forma secuencial, una por una
- [ ] Para filas de tipo `historical_sample`: llama a `selectRepresentativeSample` (US-074) con `maxPhotos: 30` y luego a `synthesizePeriodProfile` (US-076) con esa muestra
- [ ] Para filas de tipo `full`: llama a `selectRepresentativeSample` con `maxPhotos: 50` y luego a `synthesizePeriodProfile`
- [ ] Al completar cada fila, actualiza `status` a `done` y registra `processed_at` — así el proceso es reanudable
- [ ] Si Ollama falla en una fila, marca la fila como `pending` de nuevo y continúa con la siguiente (no aborta el proceso)
- [ ] Hay un delay configurable entre llamadas a Ollama para no saturar el servidor local (default: 2s entre peticiones)

### Trigger del bootstrap

- [ ] El bootstrap se detecta como necesario si `style_analysis_bootstrap` no existe o está vacía
- [ ] Se lanza automáticamente al arrancar la app si hay trabajo pendiente (integrado en el worker de background existente o como proceso propio)
- [ ] El bootstrap NO bloquea ninguna operación de la app — corre con `setTimeout`/scheduling de baja prioridad

### Estado visible (mínimo)

- [ ] En la futura vista de insights (US-077), si el bootstrap no ha terminado, se muestra un indicador: "Analizando tu catálogo — los insights estarán listos en unos días"
- [ ] Se expone `getBootstrapProgress()` en el repositorio: `{ total: number, done: number, percent: number }`

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/style-analysis/bootstrap.ts` | Nuevo — lógica del proceso de bootstrap |
| `src/lib/queries/style-analysis.ts` | Ampliar con funciones de estado del bootstrap |
| `migrations/` | Nueva migración para `style_analysis_bootstrap` |

---

## Notas técnicas

- El bootstrap puede tardar de 1 a 7 días dependiendo del tamaño del catálogo y la velocidad de Ollama — esto es esperado y correcto
- Los periodos del histórico (>24 meses) se procesan de más antiguo a más reciente para que el perfil de largo plazo se construya cronológicamente
- Los periodos de los últimos 24 meses se procesan de más reciente a más antiguo — así el usuario ve primero los insights más relevantes
- Si el usuario importa fotos antiguas después del bootstrap, esas fotos se incorporan en el ciclo continuo (US-076), no relanzando el bootstrap

---

## Fuera de alcance

- Síntesis de perfiles con Ollama (eso es US-076, que esta US llama como dependencia)
- UI completa de insights (eso es US-077)
- Configuración por parte del usuario de qué periodo analizar
