# Feature: Modelo de datos ai_config — tabla BD y API de lectura/escritura

## Historia de usuario

Como administrador de photoshelf,
quiero que la configuración de IA se persista en la base de datos,
para que los ajustes del proveedor (proveedor activo, URL Ollama, API key cloud) sobrevivan a reinicios del servidor sin depender de variables de entorno.

---

## Descripción

Prerequisito de las demás historias de EPIC-007. Crea la tabla `ai_config` en SQLite (singleton, fila única con id=1) y los endpoints API para leer y actualizar la configuración. El resto de historias de la épica consumen esta API.

---

## Criterios de aceptación

### Base de datos
- [ ] Tabla `ai_config` creada con migración automática al arrancar:
  - `enabled` (INTEGER, default 0)
  - `provider` (TEXT, default 'ollama')
  - `ollama_url`, `ollama_vision_model`, `ollama_text_model`
  - `api_key` (TEXT, nullable — almacenada en claro, instalación personal)
  - `cloud_model` (TEXT, default 'claude-haiku-4-5')
  - `updated_at`
- [ ] Fila inicial insertada con `INSERT OR IGNORE` (idempotente)
- [ ] Añadida a `src/lib/queries/` — nunca acceso directo a BD desde routes

### API
- [ ] `GET /api/settings/ai` — devuelve la configuración actual (sin exponer `api_key` completa: solo los primeros 8 caracteres + `***`)
- [ ] `PATCH /api/settings/ai` — actualiza uno o varios campos; requiere sesión

### Verificación
- [ ] La tabla se crea correctamente en instalación limpia
- [ ] Un `PATCH` persiste los valores y un `GET` posterior los devuelve

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/lib/queries/ai-config.ts` | `getAiConfig()`, `updateAiConfig()` |
| `src/app/api/settings/ai/route.ts` | GET y PATCH |
| `src/lib/db.ts` | Migración de tabla `ai_config` |

---

## Notas técnicas

- Ver esquema SQL completo en EPIC-007
- La `api_key` se almacena en claro — es una instalación personal, el riesgo es aceptable y documentado
- El `GET` enmascara la key para no exponerla en la UI (mostrar `sk-ant-••••••••`)

---

## Dependencias

- Parte de **EPIC-007**
- Prerequisito de: US-121 (esta), US-122, US-021, US-123

## Fuera de alcance

- Cifrado de la API key en BD
- Configuración por catálogo
