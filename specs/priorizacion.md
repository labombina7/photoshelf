# Backlog priorizado — photoshelf

**Última actualización:** 2026-05-23

---

## 🔴 Crítico — resolver antes del próximo release

| ID | Feature | Por qué es urgente | Esfuerzo |
|----|---------|-------------------|---------|
| **US-014** | Hardening autenticación | `SESSION_SECRET` hardcodeado = cualquiera puede forjar sesión. Sin rate limiting = fuerza bruta libre. La app está en internet. | S |
| **US-015** | Protección path traversal | Un bug de inserción en la DB podría leer archivos del sistema del NAS. | S |

---

## 🟠 Alta prioridad — impacto alto, esfuerzo bajo (quick wins)

| ID | Feature | Por qué ahora | Esfuerzo |
|----|---------|---------------|---------|
| **US-011** | Feedback errores IA | El flujo de clasificación falla en silencio. Usuarios creen que nada pasa. | S |
| **US-010** | Accesibilidad global | `aria-label`, `:focus-visible`, divs → buttons. Una sola pasada arregla todo. | S |
| **US-012** | Empty states con CTA | Onboarding roto: pantalla vacía sin saber qué hacer. | S |
| **US-018** | Optimización queries y polling | N+1 tags, polling cada 2s, sin índice GPS → carga innecesaria en el NAS 24/7. | M |

---

## 🔵 Fundamentos técnicos — prerequisitos para trabajo futuro

| ID | Feature | Por qué importa | Esfuerzo | Bloquea |
|----|---------|-----------------|---------|---------|
| **US-016** | Centralización código duplicado | `insertTag` × 5, `buildPhotoQuery` × 4, `PHOTOS_PATH` × 7. Cada feature nueva multiplica la deuda. | M | US-022 |
| **US-022** | Capa de repositorio | Prerequisito de todo EPIC-002 (API iOS). Sin esto, los endpoints v1 duplican lógica. | M | US-023, 024, 025 |
| **US-023** | Contratos API estándar | Envelope, errores, versionado. Sin esto, el cliente iOS no puede escribirse de forma robusta. | M | US-024, 025 |
| **US-020** | Actualización Next.js 15 | Versión actual tiene CVEs conocidos. Migración más sencilla ahora que más adelante. | M | — |

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
Semana 1:  US-014 + US-015       (seguridad, bloqueante)
Semana 2:  US-011 + US-012 + US-010  (UX quick wins, en paralelo)
Semana 3:  US-018 + US-016       (rendimiento + refactor base)
Semana 4:  US-020                (Next.js 15, en rama separada)
Luego:     US-022 → US-023 → US-024 + US-025  (EPIC-002 iOS)
Luego:     EPIC-001              (múltiples catálogos)
```

---

## Leyenda de esfuerzo

| Símbolo | Estimación |
|---------|-----------|
| S | < 1 día |
| M | 1–3 días |
| L | 1–2 semanas |
