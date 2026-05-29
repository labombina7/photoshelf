# Feature: Tests de integración para routes API críticas y refactor de ollama.test.ts

## Historia de usuario

Como desarrollador de photoshelf,
quiero tener tests de integración para las rutas de API más críticas y tests reales del módulo de Ollama,
para poder refactorizar con confianza y detectar regresiones de seguridad antes de desplegar.

---

## Descripción

La US-019 (Cobertura de tests) fue desplegada y estableció la infraestructura de Vitest con tests para el scanner, thumbnail y config. La auditoría de deuda técnica del 2026-05-29 identificó dos vacíos importantes que quedaron fuera de esa primera pasada:

**1. Ausencia de tests de integración para routes API**: los 9 tests existentes cubren exclusivamente lógica pura. No existe ningún test para los route handlers más críticos (`scan/route.ts`, `catalogs/route.ts`, `projects/route.ts`). Estos son precisamente los endpoints que manejan operaciones destructivas o con implicaciones de seguridad.

**2. Tests de ollama.test.ts que no testean el módulo real**: los tests actuales replican localmente las funciones de parsing en lugar de importar y testear las funciones de `ollama.ts`. Si la lógica de parsing cambia en el módulo real, los tests no detectarán la regresión.

---

## Criterios de aceptación

### Tests de integración para routes API

**Catálogos (`catalogs/route.ts`)**:
- [ ] `GET /api/catalogs` — devuelve lista de catálogos del usuario autenticado
- [ ] `POST /api/catalogs` con directorio válido → 201 + catálogo creado
- [ ] `POST /api/catalogs` con directorio inexistente → 400
- [ ] `POST /api/catalogs` sin autenticación → 401
- [ ] `DELETE /api/catalogs/[id]` con catálogo existente → 200
- [ ] `DELETE /api/catalogs/[id]` con catálogo que no existe → 404

**Scan (`scan/route.ts`)**:
- [ ] `POST /api/scan` inicia el escaneo y devuelve 202
- [ ] `POST /api/scan` cuando ya hay un escaneo en curso → 409
- [ ] `GET /api/scan/status` devuelve el estado actual del escaneo
- [ ] `POST /api/scan` sin autenticación → 401

**Auth con cobertura completa (`auth/login/route.ts`)**:
- [ ] Login correcto → 200 + cookie de sesión
- [ ] Password incorrecto → 401
- [ ] Rate limit tras 10 intentos → 429
- [ ] Body sin campo `password` → 400
- [ ] `APP_PASSWORD` no configurado → 500 o 401

### Refactor de `ollama.test.ts`
- [ ] Los tests importan `extractJsonObject` y otros helpers directamente del módulo `src/lib/ollama.ts` (o sus submódulos tras US-047)
- [ ] Solo `fetch` y `sharp` están mockeados — no se replican funciones localmente
- [ ] Si `extractJsonObject` cambia en el módulo real, los tests detectan la regresión
- [ ] Se añaden casos límite: JSON malformado, respuesta vacía de Ollama, timeout simulado

### Infraestructura
- [ ] Los tests de routes usan SQLite in-memory (`:memory:`) para aislamiento total
- [ ] iron-session se mockea para simular sesiones autenticadas y no autenticadas
- [ ] `npm test` sigue siendo el único comando necesario para correr toda la suite
- [ ] Los tests se pueden ejecutar en paralelo sin conflictos de estado

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/catalogs/__tests__/catalogs.test.ts` | Nuevo — tests de integración de catálogos |
| `src/app/api/scan/__tests__/scan.test.ts` | Nuevo — tests de integración de scan |
| `src/app/api/auth/__tests__/login.test.ts` | Completar con casos límite faltantes |
| `src/__tests__/ollama.test.ts` | Refactorizar para testear el módulo real |

---

## Notas técnicas

- Para mockear iron-session en Vitest: `vi.mock('iron-session', () => ({ getIronSession: vi.fn().mockResolvedValue({ isLoggedIn: true }) }))`. Usar `isLoggedIn: false` para tests de 401.
- Para los tests de routes, usar `fetch` de Node.js 18+ apuntando al handler directamente, o usar el patrón de Vitest con `msw` (Mock Service Worker) para interceptar las peticiones HTTP.
- Alternativamente, para tests más simples, llamar a la función handler directamente pasando un `NextRequest` mock: `handler(new NextRequest('http://localhost/api/...', { method: 'POST', body: JSON.stringify({...}) }))`.
- La BD in-memory debe inicializarse con el mismo `initSchema()` de `db.ts` para que los tests usen el esquema real.

---

## Fuera de alcance (v1)

- Tests E2E con Playwright
- Tests de componentes React (PhotoGrid, DetailPanel)
- Coverage del 100% — foco en paths críticos y casos de seguridad
- Tests de rendimiento o carga
