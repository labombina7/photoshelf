# US-070 — Clasificación Ollama en paralelo (N=2 en M1)

> Estado: ⚙️ Implementada — pendiente benchmark manual (N=1 vs N=2 con 10 fotos)

## Historia de usuario

Como fotógrafo con una biblioteca grande,
quiero que la clasificación IA tarde menos,
para procesar más fotos en el mismo tiempo sin saturar el equipo.

---

## Contexto y decisiones de diseño

### Por qué N=2 y no más

El entorno de producción es un **MacBook Air M1 16GB**. La memoria es unificada (CPU y GPU comparten el mismo pool). Con llava:7b:

| Concepto | Estimación |
|---|---|
| macOS + apps en uso | ~4-5 GB |
| llava:7b cargado en GPU | ~4.5 GB |
| Disponible para KV cache | ~6-7 GB |
| KV cache por request (imagen) | ~500MB-1GB |
| **N máximo seguro** | **N=2** |

N=3 presiona el límite; N=4 arriesga swap con degradación severa de rendimiento.

### Cómo funciona la concurrencia en Ollama

Ollama soporta concurrencia interna mediante `OLLAMA_NUM_PARALLEL`. El modelo se carga **una sola vez** en GPU; cada request paralelo comparte los pesos pero tiene su propio KV cache. La GPU procesa batches de forma intercalada — no ejecuta dos inferencias simultáneamente.

La ganancia proviene de solapar la **preparación del siguiente request** (lectura de imagen, resize, base64) con la **inferencia del anterior**:

```
N=1 (actual):  [prep 1] → [inf 1] → [prep 2] → [inf 2]   = 100% tiempo
N=2:           [prep 1] → [inf 1]
                          [prep 2] ──────────→ [inf 2]     ≈ 60-70% tiempo
```

**Mejora realista: 30-50%.** No es 2x porque la GPU sigue siendo el cuello de botella.

### Por qué Ollama en local (no en NAS)

El Synology DS220+ (Intel Celeron J4025, hasta 6GB RAM) **no tiene aceleración GPU utilizable** por Ollama en Linux. Correría en CPU pura: ~5-15 min por foto vs ~20-30s en M1. No es viable para este caso de uso.

---

## Criterios de aceptación

### Configuración Ollama

- [ ] `OLLAMA_NUM_PARALLEL=2` documentado en `README.md` y `.env.example`
- [ ] photoshelf no gestiona el arranque de Ollama — solo documenta el flag para que el usuario lo configure antes de iniciar el servidor

### Cliente (photoshelf)

- [ ] `classify/batch` y `classify/year` envían requests en **lotes de 2** usando `Promise.allSettled`
- [ ] La barra de progreso refleja correctamente el avance con lotes paralelos (incrementa de 2 en 2)
- [ ] Si un request del lote falla, el error se registra y se continúa con el resto — no aborta el lote completo
- [ ] `force=true` (reclasificación forzada) también usa lotes de 2
- [ ] El número de requests paralelos está centralizado en una constante `CLASSIFY_BATCH_SIZE = 2`

### Benchmark previo a merge

- [ ] Probar 10 fotos en N=1 vs N=2 — medir tiempo total
- [ ] Verificar que la calidad de los tags es equivalente (sin timeouts, sin respuestas truncadas)
- [ ] Si N=2 degrada calidad o genera errores de Ollama, revertir a N=1 sin cambio de API pública

---

## Componentes afectados

| Fichero | Cambio |
|---|---|
| `src/lib/ollama/classify.ts` | Procesar array de fotos en lotes de 2 con `Promise.allSettled` |
| `src/app/api/ai/classify/batch/route.ts` | Iterar en lotes en lugar de foto a foto |
| `src/app/api/ai/classify/year/route.ts` | Idem |
| `README.md` | Documentar `OLLAMA_NUM_PARALLEL=2` en sección de configuración |

---

## Notas técnicas

```typescript
// Patrón de lote paralelo
const CLASSIFY_BATCH_SIZE = 2;

for (let i = 0; i < photos.length; i += CLASSIFY_BATCH_SIZE) {
  const batch = photos.slice(i, i + CLASSIFY_BATCH_SIZE);
  const results = await Promise.allSettled(batch.map(photo => classifyPhoto(photo)));
  // procesar results — los rejected se marcan como error, no abortan
}
```

- `OLLAMA_NUM_PARALLEL` es una variable de entorno **de Ollama**, no de Next.js. Se configura antes de arrancar `ollama serve`.
- El benchmark se puede hacer con `time curl ...` o simplemente midiendo desde la UI con el timer de clasificación ya existente.

---

## Fuera de alcance

- Ollama en NAS u otro host remoto
- N configurable desde la UI de photoshelf
- Cola de prioridad entre fotos
- N=3 o superior
- Worker threads de Node.js (la concurrencia la gestiona Ollama, no Node)
