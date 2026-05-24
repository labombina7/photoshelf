# Backlog priorizado — photoshelf

**Última actualización:** 2026-05-24

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
| **US-016** | Centralización código duplicado | #36 | 2026-05-24 |
| **US-022** | Capa de repositorio | #37 | 2026-05-24 |
| **US-020** | Actualización Next.js 15 | #38 | 2026-05-24 |

---

## 🔵 Fundamentos técnicos — siguiente bloque (prerequisitos)

| ID | Feature | Por qué importa | Esfuerzo | Bloquea |
|----|---------|-----------------|---------|---------|
| **US-023** | Contratos API estándar | Envelope, errores, versionado. Sin esto, el cliente iOS no puede escribirse de forma robusta. | M | US-024, 025 |

---

## 🟡 Media prioridad — mejoras importantes sin urgencia crítica

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-017** | Hardening técnico (errores/tipos) | Try/catch en rutas API, tipos TS unificados, MIME types. Mejora resiliencia. | M |
| **US-013** | UX mobile (swipe, bottom sheet) | La web mobile es la alternativa a la app iOS mientras no existe. | M |
| **US-019** | Cobertura de tests | Sin tests en scanner.ts ni thumbnail.ts. Cada refactor es una apuesta. | L |
| **US-021** | Proveedores LLM cloud | Desacopla la dependencia de Ollama local. Valor alto cuando Ollama no está disponible. | L |

---

## 📦 Features de producto — cuando la base esté estable

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-024** | Endpoints iOS — browsing | Timeline + detalle de foto para app nativa. Depende de US-022 + US-023. | M |
| **US-025** | Endpoints iOS — acciones | Búsqueda, tags, scan, auth para app nativa. Depende de US-022 + US-023. | M |
| **US-004** | Operaciones en lote | Selección múltiple + acciones masivas. Buena UX, no es bloqueante. | M |
| **US-003** | Detección de duplicados | Útil con bibliotecas grandes pero no urgente. | L |
| **US-005** | Álbumes inteligentes | Filtros guardados como álbumes dinámicos. Feature nueva, no deuda. | L |

---

## 🏗 Épicas — trabajo en paralelo planificable

| ID | Épica | Estado | Prerequisitos |
|----|-------|--------|--------------|
| **EPIC-001** | Múltiples catálogos (US-009a→g) | Planificada, 7 historias | US-016 (ayuda) |
| **EPIC-002** | API pública iOS (US-022→25) | Planificada, 4 historias | US-016 → US-022 → US-023 |

---

## Orden de ataque recomendado

```
✅ Semana 1:  US-014 + US-015           (seguridad)          → HECHO
✅ Semana 2:  US-010 + US-011 + US-012  (UX quick wins)      → HECHO
✅ Semana 3a: US-018                    (rendimiento)         → HECHO

✅ Semana 3b: US-016                    (centralizar código duplicado) → HECHO

✅ Semana 4:  US-022                     (capa de repositorio) → HECHO

✅ Semana 4b: US-020                    (Next.js 15) → HECHO

▶ Semana 5:  US-023                    (contratos API estándar)
  Semana 6:  US-024 + US-025           (endpoints iOS)
  Luego:     US-017 + US-013           (hardening técnico + mobile)
  Luego:     EPIC-001                  (múltiples catálogos)
```

---

## Leyenda de esfuerzo

| Símbolo | Estimación |
|---------|-----------|
| S | < 1 día |
| M | 1–3 días |
| L | 1–2 semanas |
