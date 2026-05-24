# Backlog priorizado — photoshelf

**Última actualización:** 2026-05-24 (EPIC-001 múltiples catálogos desplegada)

---

## ✅ Desplegado

| ID | Feature | PR | Fecha |
|----|---------|----|-------|
| **US-014** | Hardening autenticación | #34 | 2026-05-23 |
| **US-015** | Protección path traversal | #34 | 2026-05-23 |
| **US-010** | Accesibilidad global | #35 | 2026-05-23 |
| **US-011** | Feedback errores IA | #35 | 2026-05-23 |
| **US-012** | Empty states con CTA | #35 | 2026-05-23 |
| **US-018** | Optimización queries y polling | #35 | 2026-05-23 |
| **US-016** | Centralización código duplicado (`db-helpers.ts`) | #36 | 2026-05-24 |
| **US-022** | Capa de repositorio (`src/lib/queries/`) | #37 | 2026-05-24 |
| **US-020** | Actualización Next.js 15 + React 19 | #38 | 2026-05-24 |
| **US-013** | UX mobile — swipe gestures y bottom sheet | #40 | 2026-05-24 |
| **US-019** | Cobertura de tests (config, scanner, thumbnail, auth) | #41 | 2026-05-24 |
| **US-027** | Mapa — filtro por año (rendimiento catálogos grandes) | — | 2026-05-24 |
| **US-026** | Personalidad visual (iconografía, micro-interacciones) | #42 | 2026-05-24 |
| **EPIC-001** | Múltiples catálogos (US-009a–g) | #43 | 2026-05-24 |

---

## 🔵 Siguiente — fundamento iOS (prerequisito)

| ID | Feature | Por qué importa | Esfuerzo | Bloquea |
|----|---------|-----------------|---------|---------|
| **US-023** | Contratos API estándar | Envelope uniforme, errores consistentes, prefijo de versión. Sin esto el cliente iOS es frágil. | M | US-024, 025 |

---

## 🟡 Mejoras técnicas — media prioridad

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-017** | Hardening técnico (errores/tipos) | Try/catch en rutas API, tipos TS unificados, MIME types. | M |
| **US-021** | Proveedores LLM cloud | Desacopla la dependencia de Ollama local. Activa IA cuando Ollama no está disponible. | L |

---

## 📦 Features de producto — cuando la base esté estable

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-024** | Endpoints iOS — browsing | Timeline + detalle de foto para app nativa. Depende de US-023. | M |
| **US-025** | Endpoints iOS — acciones | Búsqueda, tags, scan, auth para app nativa. Depende de US-023. | M |
| **US-004** | Operaciones en lote | Selección múltiple + acciones masivas. Buena UX, no bloqueante. | M |
| **US-003** | Detección de duplicados | Útil con bibliotecas grandes, no urgente. | L |
| **US-005** | Álbumes inteligentes | Filtros guardados como álbumes dinámicos. Feature nueva, no deuda. | L |

---

## 🏗 Épicas

| ID | Épica | Estado | Prerequisitos |
|----|-------|--------|--------------|
| **EPIC-001** | Múltiples catálogos (US-009a→g) | ✅ Desplegada — PR #43 | — |
| **EPIC-002** | API pública iOS (US-023→25) | 🔵 En curso — US-022 ✅, siguiente US-023 | US-016 ✅ → US-022 ✅ → US-023 |

---

## Orden de ataque

```
✅ Semana 1:   US-014 + US-015                    (seguridad)                     → HECHO
✅ Semana 2:   US-010 + US-011 + US-012           (UX quick wins)                 → HECHO
✅ Semana 3a:  US-018                             (optimización queries/polling)  → HECHO
✅ Semana 3b:  US-016                             (centralizar código duplicado)  → HECHO
✅ Semana 4a:  US-022                             (capa de repositorio)           → HECHO
✅ Semana 4b:  US-020                             (Next.js 15 + React 19)         → HECHO
✅ Semana 4c:  US-013 + US-019 + US-027           (mobile, tests, mapa)           → HECHO
✅ Semana 4d:  US-026                             (personalidad visual)           → HECHO
✅ Semana 5:   EPIC-001 (US-009a–g)               (múltiples catálogos)           → HECHO

▶ Semana 6:   US-023                             (contratos API estándar)
  Semana 7:   US-024 + US-025                    (endpoints iOS)
  Luego:      US-017                             (hardening técnico)
  Luego:      US-021                             (proveedores LLM cloud)
  Luego:      US-004 + US-003 + US-005           (features de producto)
```

---

## Leyenda de esfuerzo

| Símbolo | Estimación |
|---------|-----------|
| S | < 1 día |
| M | 1–3 días |
| L | 1–2 semanas |
