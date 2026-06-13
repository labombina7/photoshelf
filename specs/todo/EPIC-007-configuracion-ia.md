# EPIC-007: Configuración de modelos de IA

## Resumen

Implementar la subsección "Modelos de IA" dentro de la sección de Settings (EPIC-006),
permitiendo al usuario activar o desactivar las funcionalidades de IA y configurar el
proveedor que las alimenta: Ollama local o un proveedor cloud (Anthropic y otros).
La IA pasa de ser una dependencia implícita de Ollama a ser una feature opcional y configurable.

---

## Motivación

Actualmente photoshelf asume que Ollama está disponible en localhost. Si no lo está,
la clasificación, búsqueda semántica y Tu Estilo fallan sin dar una buena explicación.
Esto genera fricción para nuevos usuarios y hace imposible usar photoshelf en máquinas
sin GPU o sin Ollama instalado.

Con esta épica:
- La IA es **opcional** — photoshelf funciona al 100% sin ella (búsqueda por tags, metadatos, etc.)
- El usuario elige su proveedor y lo valida antes de activar
- Se sientan las bases para distribuir photoshelf a usuarios no técnicos

---

## Prerequisitos

- **EPIC-006** desplegada — la subsección `/settings/ai` debe existir como placeholder

---

## Estructura de la subsección `/settings/ai`

```
/settings/ai
  Toggle: "Activar funcionalidades de IA"   ← desactivado por defecto en instalaciones nuevas
  
  [Si activado]
  Selector de proveedor:
    ○ Ollama (local)
        URL: [http://localhost:11434    ]
        Modelo visión: [llava           ]
        Modelo texto:  [llama3          ]
        [Verificar conexión]
    
    ○ Anthropic
        API Key: [sk-ant-...            ] [👁]
        Modelo: claude-haiku-4-5 (recomendado) / claude-sonnet-4-6
        [Validar API key]
  
  Estado: ● Conectado / ✗ Sin conexión / — No configurado
  
  [Si cloud activo]
  Aviso: "Tu Estilo analiza un gran volumen de fotos y puede generar costes significativos.
          Revisa el coste estimado antes de lanzarlo."
```

---

## Decisiones de diseño

| Decisión | Detalle |
|---|---|
| **IA desactivada por defecto** | En instalaciones nuevas la IA está off. El usuario la activa conscientemente. |
| **Datos existentes se mantienen** | Desactivar la IA no borra tags ni análisis previos. |
| **Cambio de proveedor no reclasifica** | Las fotos ya clasificadas conservan sus tags. Reclasificar es una acción explícita del usuario. |
| **Búsqueda degrada gracefully** | Sin IA, la búsqueda funciona sobre tags manuales, eventos y metadatos EXIF. |
| **Validación antes de activar** | No se puede guardar el proveedor sin haber verificado la conexión/key. |
| **Proveedores: local vs cloud** | Ollama es `type: local`; Anthropic y futuros proveedores son `type: cloud`. Esta distinción guía mensajes de error y avisos de coste. |

---

## Historias hijas

| ID | Título | Esfuerzo | Prerequisitos |
|----|--------|----------|--------------|
| [US-121](US-121-ai-config-bd-api.md) | Modelo de datos: tabla `ai_config` en BD + API de lectura/escritura | S | — |
| [US-021](US-021-proveedores-llm-cloud.md) | Capa de abstracción de proveedor: interfaz `AIProvider` + adaptadores Ollama y Anthropic | M | US-121 |
| [US-122](US-122-ui-configuracion-proveedor-ia.md) | UI: toggle de IA + selector de proveedor + validación | M | US-121, EPIC-006 ✅ |
| [US-123](US-123-integrar-get-ai-provider.md) | Integrar `getAIProvider()` en todas las funciones que usan Ollama directamente | M | US-021 |
| [US-124](US-124-busqueda-degradada-sin-ia.md) | Búsqueda semántica degrada a búsqueda por texto/tags cuando la IA está desactivada | S | US-123 |
| [US-125](US-125-aviso-coste-cloud-tu-estilo.md) | Aviso de coste estimado en Tu Estilo cuando el proveedor es cloud | S | US-122, US-123 |

---

## Modelo de datos

```sql
CREATE TABLE ai_config (
  id           INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton
  enabled      INTEGER NOT NULL DEFAULT 0,           -- toggle global
  provider     TEXT NOT NULL DEFAULT 'ollama',       -- 'ollama' | 'anthropic'
  
  -- Ollama
  ollama_url         TEXT NOT NULL DEFAULT 'http://localhost:11434',
  ollama_vision_model TEXT NOT NULL DEFAULT 'llava',
  ollama_text_model   TEXT NOT NULL DEFAULT 'llama3',
  
  -- Cloud (Anthropic y futuros)
  api_key      TEXT,   -- almacenado en claro en BD local (instalación personal)
  cloud_model  TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ai_config (id) VALUES (1);
```

---

## Interfaz AIProvider

```typescript
// src/lib/ai/provider.ts
export interface AIProvider {
  type: 'local' | 'cloud';
  generateText(prompt: string): Promise<string>;
  generateVision(prompt: string, base64Image: string): Promise<string>;
  checkConnection(): Promise<{ ok: boolean; error?: string }>;
}
```

Adaptadores:
- `src/lib/ai/adapters/ollama.ts` — refactoriza el código actual de `ollama.ts`
- `src/lib/ai/adapters/anthropic.ts` — nuevo, usa `@anthropic-ai/sdk`

Factory:
- `src/lib/ai/index.ts` — exporta `getAIProvider(): AIProvider | null` (null si IA desactivada)

---

## Comportamiento con IA desactivada

| Funcionalidad | Con IA | Sin IA |
|---|---|---|
| Clasificación de fotos | Genera tags automáticos | Botón deshabilitado con tooltip explicativo |
| Búsqueda semántica | Interpreta lenguaje natural | Busca sobre tags, eventos, cámara, año |
| Valoración de foto | Genera análisis con IA | Sección oculta |
| Tu Estilo | Análisis completo | Sección oculta |
| Resto de la app | — | Sin cambios |

---

## Validación por proveedor

**Ollama:**
1. Verificar que `{url}/api/tags` responde (Ollama está corriendo)
2. Verificar que el modelo de visión configurado está en la lista de modelos descargados
3. Si el modelo no está: error descriptivo "Ollama responde pero el modelo `llava` no está descargado"

**Anthropic:**
1. Hacer una llamada mínima a la API con la key proporcionada
2. Si la key es inválida: error "API key incorrecta"
3. Si la key es válida pero sin créditos: advertencia "API key válida pero sin saldo disponible"

---

## Criterios de éxito

- photoshelf arranca y funciona sin Ollama instalado
- El usuario puede activar la IA, configurar Anthropic con su API key y clasificar fotos
- El usuario puede cambiar de Ollama a Anthropic sin perder los tags existentes
- La búsqueda funciona (degradada) cuando la IA está desactivada
- Tu Estilo muestra aviso de coste antes de lanzarse con proveedor cloud

---

## Fuera de alcance (v1)

- Fallback automático entre proveedores
- Soporte de OpenAI, Google Gemini u otros (la arquitectura lo permite, no se implementa)
- Tracking de costes por foto procesada
- UI para reclasificar fotos existentes con el nuevo proveedor (queda como botón futuro)
- Configuración de IA por catálogo (mismo proveedor para todos)
