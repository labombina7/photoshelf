# CLAUDE.md — photoshelf

Guía de codificación para el proyecto photoshelf. Estos aprendizajes se recogen tras implementaciones reales y deben aplicarse en toda historia de usuario nueva.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict: true)
- **SQLite** con `better-sqlite3` (síncrono) — acceso via capa de repositorio en `src/lib/queries/`
- **Tailwind** no se usa — estilos en `src/app/globals.css` (variables CSS + clases custom)
- **Ollama** local para IA — siempre considerar que puede no estar disponible

---

## Convenciones de código

### Route handlers (`src/app/api/**/route.ts`)

**Patrón obligatorio** — todo handler debe seguir esta estructura:

```typescript
export async function GET(req: NextRequest) {
  // 1. Auth check — siempre primero, fuera del try/catch
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Validación de parámetros — fuera del try/catch si son 400s controlados
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // 3. Lógica — SIEMPRE dentro de try/catch
  try {
    const result = doSomething();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[nombre-ruta] Error description:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Reglas:**
- El auth check va **fuera** del try/catch — un 401 no es un error inesperado
- Las validaciones de parámetros (400) pueden ir fuera del try/catch cuando son comprobaciones simples
- El `console.error` incluye siempre: `[ruta]` como prefijo + el error original completo (no solo `err.message`)
- Para errores de Ollama o externos, el mensaje del error se puede propagar al cliente: `err instanceof Error ? err.message : 'Unknown error'`
- Respuesta de error consistente: `{ error: string }` — nunca `{ message: string }` ni otros formatos

### Formato de errores

| Situación | Status | Body |
|---|---|---|
| No autenticado | 401 | `{ error: 'Unauthorized' }` |
| Parámetro inválido | 400 | `{ error: 'Description' }` |
| Recurso no encontrado | 404 | `{ error: 'Not found' }` |
| Conflicto de estado | 409 | `{ error: 'Description' }` |
| Error externo (Ollama) | 500 | `{ error: err.message }` |
| Error inesperado interno | 500 | `{ error: 'Internal server error' }` |

### Constantes de configuración

No definir constantes localmente en route handlers ni en otros módulos. Importar siempre desde `src/lib/config.ts`, que es la fuente única de verdad para:

- MIME types: `MIME_TYPES`, `FALLBACK_MIME`
- Paths: `PHOTOS_PATH`, `BACKUP_PATH`
- Ollama: `OLLAMA_URL`, `OLLAMA_TIMEOUT_TEXT_MS`, `OLLAMA_TIMEOUT_VISION_MS`, `OLLAMA_IMAGE_SIZE`
- Límites: `PHOTOS_MAX_LIMIT`, `CLASSIFY_BATCH_SIZE`, `BACKUP_MAX_KEEP`, `THUMBNAIL_SIZES`
- Sharing: `SHARE_TOKEN_TTL_HOURS`, `SHARE_MAX_PHOTOS`, `SHARE_RETRY_WINDOW_MINUTES`
- Auth: `AUTH_RATE_LIMIT_ATTEMPTS`, `AUTH_RATE_LIMIT_WINDOW_MS`
- Watcher: `WATCHER_DEBOUNCE_MS`, `WATCHER_POLL_MS`

```typescript
import { MIME_TYPES, FALLBACK_MIME, PHOTOS_MAX_LIMIT } from '@/lib/config';
```

### Tipos TypeScript

- No usar `as any` salvo para workarounds de librerías de terceros (con comentario `// eslint-disable-next-line @typescript-eslint/no-explicit-any`)
- Los resultados de queries SQLite siempre con tipo explícito: `db.prepare(...).get() as { id: number; name: string } | undefined`
- `strict: true` ya está en `tsconfig.json` — el build debe pasar sin errores

### Acceso a datos

- **Nunca** importar `getDb()` directamente en pages o route handlers nuevos
- Usar siempre funciones del repositorio en `src/lib/queries/`
- Si necesitas una query que no existe en el repositorio, añádela allí

### Operaciones con Ollama

- Siempre dentro de try/catch — Ollama puede no estar disponible
- Si Ollama falla en una operación individual (ej. clasificar una foto), loguear y continuar (no abortar el lote entero)
- Si Ollama falla en una operación completa (ej. búsqueda), devolver el mensaje de error al cliente con 500
- Propagar `err.message` al cliente cuando el error es de Ollama (el usuario necesita saber si es timeout, modelo no encontrado, etc.)

---

## Estructura del proyecto

```
src/
  app/
    api/              # Route handlers — todos con try/catch
    (vistas)/         # Pages — Server Components, sin SQL inline
  components/         # Componentes React reutilizables
  lib/
    config.ts         # Fuente única de todas las constantes y variables de entorno
    db.ts             # getDb() — solo para usar en queries/
    db-helpers.ts     # upsertAiTags, buildPhotoFilter
    queries/          # Capa de repositorio — única fuente de SQL
    ollama/           # Módulos de integración con Ollama (client, classify, search…)
    search/           # Lógica de búsqueda unificada
    style-analysis/   # Motor de análisis de estilo fotográfico (EPIC-004)
    worker.ts         # Worker de jobs en background (clasificación, backup, proyectos)
    session.ts        # Gestión de sesión
    types.ts          # Tipos compartidos
    analytics.ts      # Amplitude (cliente)
    amplitude.ts      # Amplitude (server-side sync)
  instrumentation.ts  # Arranque del worker con el servidor (Next.js instrumentation hook)
```

---

## Specs y planificación

- Las épicas van en `specs/todo/EPIC-XXX-nombre.md`
- Las historias van en `specs/todo/US-XXX-nombre.md`
- Al desplegar una US, añadir `> Estado: ✅ Desplegada` y mover a `specs/done/`
- El kanban se mantiene en `specs/kanban.html` — actualizar siempre que se añadan/completen historias

---

## Aprendizajes por US implementada

### US-017 — Hardening técnico (2026-05-28)

**Lo que encontramos:**
- `tsconfig.json` ya tenía `strict: true` — el criterio de TypeScript estricto ya se cumplía
- `MIME_TYPES` estaba definido localmente en `photos/[id]/original/route.ts` — se movió a `config.ts`
- 19 de 42 routes carecían de try/catch exterior, incluyendo las que llaman a Ollama
- El único `as any` legítimo es en `scanner.ts` para `exifr.parse` (librería sin tipos completos) — ya tenía el comentario `eslint-disable`
- Los routes de `/api/v1/` (creados en EPIC-002) ya seguían el patrón correcto con try/catch

**Decisiones tomadas:**
- El auth check queda **fuera** del try/catch — es una validación controlada, no un error inesperado
- Para errores de Ollama se propaga `err.message` al cliente (el usuario puede ver "model not found", "connection refused", etc.)
- Para errores internos de BD u otros inesperados se devuelve el mensaje genérico "Internal server error"
- Los routes de estado/polling (scan/status, classify/status, watcher/status) también se wrappean aunque raramente fallen — por consistencia

**Patrón que funciona para routes que llaman a Ollama:**
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[ruta] Error:', message);
  return NextResponse.json({ error: message }, { status: 500 });
}
```
