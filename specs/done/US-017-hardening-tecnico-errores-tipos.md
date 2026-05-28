# Feature: Hardening técnico — manejo de errores, tipos TypeScript y MIME types

> Estado: ✅ Desplegada — PR #60 mergeado en main

## Historia de usuario

Como desarrollador de photoshelf,
quiero que todas las rutas de API tengan manejo de errores explícito y tipos TypeScript correctos,
para que los fallos se registren y devuelvan respuestas HTTP consistentes en lugar de crashear el proceso.

---

## Descripción

El análisis de deuda técnica identificó tres categorías de fragilidad técnica:

1. **Rutas API sin try/catch**: varios route handlers no capturan errores, causando que el
   proceso devuelva respuestas 500 sin información útil o que Next.js devuelva una página de error.
2. **Uso de `any` en TypeScript**: tipado laxo en queries SQLite y respuestas de Ollama dificulta
   el refactoring y oculta bugs.
3. **MIME types inconsistentes**: el endpoint `/api/photos/[id]/original` no cubre todos los
   formatos que el escáner puede indexar (HEIC, TIFF, AVIF).

Esta US aplica una pasada de hardening técnico en estas tres áreas.

---

## Criterios de aceptación

### Try/catch en rutas API
- [ ] Todas las rutas en `src/app/api/` tienen un try/catch que captura errores inesperados
- [ ] En caso de error inesperado, se devuelve HTTP 500 con `{ error: 'Internal server error' }`
  y el error se loguea con `console.error` (incluyendo el error original, no sólo el mensaje)
- [ ] Los errores de validación de parámetros devuelven HTTP 400, no 500

### Tipos TypeScript
- [ ] Los resultados de queries SQLite usan tipos explícitos (no `as any`)
- [ ] Las respuestas de Ollama tienen un tipo `OllamaResponse` en lugar de parseo sin tipo
- [ ] `tsconfig.json` tiene `"strict": true` o al menos `"noImplicitAny": true`
- [ ] Build sin errores de tipo con la configuración estricta

### MIME types centralizados
- [ ] Existe un objeto `MIME_TYPES` en `src/lib/config.ts` (o `src/lib/mime.ts`) que mapea
  extensión → Content-Type para todos los formatos soportados: `.jpg`, `.jpeg`, `.png`,
  `.webp`, `.heic`, `.heif`, `.tiff`, `.tif`, `.avif`
- [ ] El endpoint `/api/photos/[id]/original` usa este mapa en lugar de un switch hardcodeado
- [ ] Si la extensión no está en el mapa, devuelve `application/octet-stream` como fallback

### Consistencia de respuestas
- [ ] Todas las respuestas de error de la API usan el mismo formato: `{ error: string }`
- [ ] Las respuestas de éxito tienen tipos de retorno explícitos en los route handlers

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/config.ts` | Añadir `MIME_TYPES` map |
| `src/app/api/photos/[id]/original/route.ts` | Usar `MIME_TYPES`, mejorar try/catch |
| `src/app/api/scan/route.ts` | Try/catch, tipos en respuesta |
| `src/app/api/ai/search/route.ts` | Try/catch, tipos |
| `src/app/api/projects/route.ts` | Try/catch, tipos |
| Otros route handlers | Pasada sistemática |

---

## Notas técnicas

- No modificar contratos de API — sólo añadir try/catch y mejorar tipos internos
- Priorizar los endpoints más usados: `photos`, `scan`, `ai/search`, `thumbnail`, `original`
- Para los tipos SQLite, usar `as PhotoRow` con interface definida, no `as any`

---

## Fuera de alcance (v1)

- Error tracking externo (Sentry, Datadog)
- Logs estructurados (JSON logging)
- Respuestas de error con códigos de error tipados (enum)
