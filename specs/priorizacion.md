# Backlog priorizado — photoshelf

**Última actualización:** 2026-06-13

---

## ✅ Desplegado (resumen)

| Área | US / EPICs |
|------|-----------|
| Seguridad | US-014, US-015, US-043 |
| UX / Accesibilidad | US-010, US-011, US-012, US-013, US-026, US-039, US-041, US-042, US-097, US-098, US-099, US-109 |
| Rendimiento | US-018, US-045, US-086 |
| Código / Arquitectura | US-016, US-017, US-022, US-046, US-047, US-084, US-085, US-087, US-108 |
| Tests / CI | US-019, US-048, US-083, US-100 |
| Stack | US-020 (Next.js 15 + React 19) |
| Mapa | US-002, US-027 |
| Búsqueda | US-028, US-029, US-030, US-031, US-032, US-033, US-034, US-063, US-069, US-073 |
| Visor / Galería | US-007, US-008, US-009, US-035, US-036, US-038, US-040, US-050, US-051, US-067, US-091 |
| Catálogos | EPIC-001 (US-009a–g), US-065, US-102 |
| API v1 | US-023, US-024 |
| Estadísticas | US-006, US-061 |
| Memorias | US-062 |
| Análisis fotográfico | EPIC-004 (US-074, US-075, US-076, US-077), US-093, US-094 |
| Sharing | US-092, US-103 |
| Backend / Docker | US-056, US-072, US-082, US-088, US-089, US-090, US-101, US-104, US-105, US-106 |
| Backup | US-072, US-088 |
| Analytics | US-068 |
| Timeline | US-001, US-007, US-008, US-009 |

---

## 🔵 Próximo — deuda técnica activa

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-107** | Consolidación API v1 | Eliminar la doble superficie legacy vs `/api/v1`. Hoy dos implementaciones pueden divergir. | M |
| **US-095** | Evolución fotográfica: gráficas + análisis IA | Extiende EPIC-004 con visualizaciones temporales y análisis on demand. | M |
| **US-066** | Afinamiento de prompts Ollama | Mejorar la calidad de clasificación ajustando los prompts del modelo. | S |

---

## 🟡 Features de producto — media prioridad

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-110** | Gestión de tags en lote | Renombrar, fusionar, eliminar tags desde la UI. | M |
| **US-025** | Endpoints iOS — acciones | Búsqueda, tags, scan, auth para app nativa. Depende de US-023 ✅. | M |
| **US-004** | Operaciones en lote | Selección múltiple + acciones masivas. | M |
| **US-113** | Notas y pies de foto | Anotaciones manuales por foto. | S |
| **US-059** | Revisión de confianza en tags IA | UI para validar/rechazar tags generados por la IA. | M |
| **US-049** | Modo comparación de fotos | Ver dos fotos lado a lado. | S |

---

## 📦 Features avanzadas — baja prioridad / largo plazo

| ID | Feature | Motivación | Esfuerzo |
|----|---------|------------|---------|
| **US-003** | Detección de duplicados | Útil con bibliotecas grandes. | L |
| **US-021** | Proveedores LLM cloud | Desacopla Ollama local. Activa IA cuando Ollama no está disponible. | L |
| **US-052** | Búsqueda por cara / agrupación personas | Identificación facial, álbumes de personas. | L |
| **US-053** | Actividad reciente / historial de cambios | Registro de acciones del usuario. | M |
| **US-054** | Culling rápido de ráfagas | Selección eficiente de la mejor foto de una ráfaga. | M |
| **US-055** | Detección de pares RAW+JPEG | Mostrar y gestionar archivos RAW con su JPEG asociado. | M |
| **US-057** | Exportar catálogo sin lock-in | Exportar metadatos y etiquetas a formatos estándar. | M |
| **US-058** | Búsqueda por similitud visual | Encontrar fotos visualmente parecidas a una dada. | L |
| **US-060** | Editor de geotags en lote | Asignar/editar coordenadas GPS a múltiples fotos. | M |
| **US-064** | Wizard de organización para biblioteca caótica | Guía para organizar fotos sin estructura. | M |
| **US-111** | Galería pública por proyecto | Publicar una selección de fotos con URL pública. | L |
| **US-112** | Modo marco digital / kiosk | Presentación continua a pantalla completa para marcos digitales. | M |
| **US-114** | Modo invitado de solo lectura | Acceso sin contraseña con permisos restringidos. | M |

---

## 🏗 Épicas

| ID | Épica | Estado | Prerequisitos |
|----|-------|--------|--------------|
| **EPIC-001** | Múltiples catálogos (US-009a→g) | ✅ Desplegada — PR #43 | — |
| **EPIC-002** | API pública iOS (US-023→25) | 🔵 En curso — US-023 ✅, US-024 ✅, pendiente US-025 | — |
| **EPIC-003** | Búsqueda unificada en header | ✅ Desplegada | — |
| **EPIC-004** | Análisis de estilo fotográfico (US-074→77) | ✅ Desplegada | — |
| **EPIC-005** | Reestructura de navegación y filtros | 🗂 Planificada | — |
| **EPIC-006** | Reorganización de Settings | 🗂 Planificada | — |
| **EPIC-007** | Configuración de modelos de IA | 🗂 Planificada | EPIC-006 |
