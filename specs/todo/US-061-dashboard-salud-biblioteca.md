# Feature: Dashboard de salud de la biblioteca

## Historia de usuario

Como fotógrafo con una colección grande acumulada durante años,
quiero ver de un vistazo en qué estado está mi biblioteca y qué tengo pendiente de organizar,
para saber por dónde empezar sin sentirme abrumado.

---

## Descripción

El mayor bloqueador del fotógrafo amateur con una biblioteca caótica no es la falta de herramientas — es no saber por dónde empezar. "Tengo 20.000 fotos, ¿qué hago primero?". La respuesta que nadie da bien es: un diagnóstico claro de qué está bien y qué no.

Esta US añade un dashboard de salud que analiza la biblioteca en siete dimensiones y presenta un "estado de la biblioteca" con indicadores visuales y acciones directas para mejorar cada dimensión. Es la pantalla que responde a "¿en qué estado está mi biblioteca hoy?".

Las siete dimensiones:

1. **Cobertura de indexación**: % de archivos en disco que están en la DB
2. **Cobertura de clasificación IA**: % de fotos con al menos un tag IA
3. **Cobertura GPS**: % de fotos con coordenadas GPS
4. **Duplicados detectados**: número de grupos de duplicados pendientes de resolver
5. **Pares RAW+JPEG**: número de pares detectados
6. **Tags IA pendientes de revisión**: fotos con tags sin validar
7. **Integridad**: archivos huérfanos o no indexados detectados en el último análisis

---

## Criterios de aceptación

### Dashboard principal
- [ ] Ruta `/health` accesible desde el sidebar con icono de pulso/salud
- [ ] Vista con siete tarjetas de métricas, cada una con:
  - Título de la dimensión
  - Valor numérico y porcentaje (ej. "8.240 de 12.000 fotos clasificadas — 68%")
  - Barra de progreso visual (0–100%)
  - Estado semáforo: verde (≥90%), ámbar (50–89%), rojo (<50%)
  - Botón de acción directo: "Clasificar fotos", "Verificar integridad", "Gestionar duplicados", etc.
- [ ] Un score global de salud de 0–100 calculado como media ponderada de las siete dimensiones
- [ ] Fecha del último cálculo y botón "Actualizar" para recalcular

### Cálculo de métricas
- [ ] Las métricas se calculan con queries a la DB (no requieren análisis de disco, excepto "Cobertura de indexación" e "Integridad" que son opcionales y más lentas)
- [ ] Las métricas ligeras (clasificación, GPS, duplicados, pares, tags pendientes) se calculan en < 1 segundo
- [ ] Las métricas que requieren acceso a disco (cobertura de indexación, integridad) se calculan solo si el usuario pulsa "Análisis completo" y se cachean por 24h

### Tendencia histórica
- [ ] El score global y las métricas se persisten diariamente en la DB
- [ ] Un mini-gráfico de línea muestra la evolución del score durante los últimos 30 días
- [ ] Si el score mejora respecto al día anterior: "↑ +3 pts respecto a ayer"

### Resumen de acciones pendientes
- [ ] Sección "Por hacer" con una lista priorizada: las 3 acciones que más mejorarían el score
- [ ] Cada acción muestra: descripción del problema, impacto estimado en el score, y botón de acción directo

---

## API necesaria

### `GET /api/health`
Devuelve las métricas actuales de la biblioteca.

```json
{
  "score": 72,
  "computed_at": "2026-05-29T10:00:00Z",
  "metrics": {
    "indexing": { "value": 11800, "total": 12000, "pct": 98, "status": "green" },
    "classification": { "value": 8240, "total": 12000, "pct": 68, "status": "amber" },
    "gps": { "value": 4200, "total": 12000, "pct": 35, "status": "red" },
    "duplicates": { "groups": 12, "status": "amber" },
    "raw_pairs": { "pairs": 310, "status": "amber" },
    "tags_review": { "pending": 234, "status": "amber" },
    "integrity": { "orphans": 0, "status": "green" }
  }
}
```

### `GET /api/health/history`
Evolución del score de los últimos 30 días.

---

## Ruta y navegación

- Ruta: `/health`
- Acceso: sidebar → entrada "Salud" con semáforo del score actual como indicador visual
- El score global se muestra también como un pequeño badge en el sidebar para motivar mejoras

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/health/page.tsx` | Server component — carga métricas |
| `src/app/health/HealthClient.tsx` | Client — tarjetas, gráfico de tendencia, acciones |
| `src/app/api/health/route.ts` | Nuevo — métricas agregadas |
| `src/app/api/health/history/route.ts` | Nuevo — histórico |
| `src/lib/queries/health.ts` | Nuevo — queries de las siete dimensiones |
| `src/lib/db.ts` | Tabla `health_snapshots` para histórico diario |
| `src/components/Sidebar.tsx` | Entrada "Salud" con badge de score |

---

## Notas técnicas

- La mayoría de las métricas son `SELECT COUNT(*)` con condiciones simples sobre `photos` y `photo_tags` — todas resueltas en < 100ms incluso con 100k fotos.
- El score global: media ponderada donde clasificación e integridad tienen más peso que GPS o duplicados. Los pesos son configurables en una constante, no en la DB.
- El histórico: INSERT diario automático en `health_snapshots (date, score, metrics_json)`. Si ya existe un registro para hoy, UPDATE. Ejecutado al cargar `/health`.
- El gráfico de tendencia puede ser un simple SVG path generado server-side o un componente de canvas client-side ligero.

---

## Fuera de alcance (v1)

- Comparación de score entre múltiples catálogos
- Alertas por email/notificación cuando el score cae
- Exportar el informe de salud como PDF
- Benchmarking contra otros usuarios de photoshelf (requeriría telemetría)
