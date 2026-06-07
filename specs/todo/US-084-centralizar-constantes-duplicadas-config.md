# Feature: Centralizar constantes duplicadas — MIME_TYPES, OLLAMA_URL y dead code

## Historia de usuario

Como desarrollador de photoshelf,
quiero que las constantes de configuración (tipos MIME y URL de Ollama) estén definidas en un único lugar,
para que un cambio de valor se aplique en todo el sistema sin riesgo de inconsistencias entre copias.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó tres problemas de duplicación de constantes que ya han causado divergencias observables:

**1. `MIME_TYPES` duplicado con divergencia real**: `src/lib/config.ts` define 9 tipos MIME (sin `.avif`). `src/app/api/v1/photos/[id]/original/route.ts` define su propia copia local con 10 entradas (incluye `.avif`). La API v1 ya soporta `.avif` pero la API interna no — el comportamiento es inconsistente entre ambas rutas.

**2. `OLLAMA_URL` definido dos veces**: `src/app/api/ollama/status/route.ts` y `src/lib/ollama/client.ts` definen `const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'` de forma idéntica. Si se cambia el fallback en uno, el endpoint de estado reporta disponibilidad de una URL diferente a la que usan las llamadas reales de clasificación.

**3. Dead code: `src/lib/queries/catalog.ts`**: contiene `getDefaultCatalog()` que retorna siempre `{ id: 1 }`, un stub creado antes de EPIC-001. EPIC-001 está desplegado, ningún fichero importa esta función, y el fichero genera confusión sobre si todavía es relevante.

Los tres fixes son puramente de refactor — ninguno cambia comportamiento observable para el usuario.

---

## Criterios de aceptación

### MIME_TYPES centralizado
- [ ] `config.ts` incluye `.avif: 'image/avif'` en el mapa `MIME_TYPES`
- [ ] `src/app/api/v1/photos/[id]/original/route.ts` elimina su objeto `MIME_TYPES` local e importa desde `config.ts`
- [ ] El build de TypeScript pasa sin errores
- [ ] Una petición a `/api/v1/photos/:id/original` para una foto `.avif` devuelve `Content-Type: image/avif`

### OLLAMA_URL centralizado
- [ ] `config.ts` exporta `OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'`
- [ ] `src/app/api/ollama/status/route.ts` importa `OLLAMA_URL` desde `config.ts`
- [ ] `src/lib/ollama/client.ts` importa `OLLAMA_URL` desde `config.ts`
- [ ] Ambos ficheros eliminan su definición local de la constante

### Dead code eliminado
- [ ] `src/lib/queries/catalog.ts` es eliminado
- [ ] `grep -r "getDefaultCatalog"` en `src/` no produce ningún resultado
- [ ] `grep -r "queries/catalog'" src/` no produce ningún resultado

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/config.ts` | Añadir `.avif` a `MIME_TYPES`; añadir y exportar `OLLAMA_URL` |
| `src/app/api/v1/photos/[id]/original/route.ts` | Eliminar `MIME_TYPES` local; importar desde `config.ts` |
| `src/app/api/ollama/status/route.ts` | Eliminar `const OLLAMA_URL`; importar desde `config.ts` |
| `src/lib/ollama/client.ts` | Eliminar `const OLLAMA_URL`; importar desde `config.ts` |
| `src/lib/queries/catalog.ts` | Eliminar fichero |

---

## Notas técnicas

- Verificar que `src/lib/__tests__/config.test.ts` cubra `OLLAMA_URL` y el tipo `.avif` tras el cambio
- El índice `src/lib/queries/index.ts` puede importar de `catalog.ts` — verificar antes de borrar

---

## Fuera de alcance (v1)

- Centralizar otros valores de configuración no duplicados
- Validación de `OLLAMA_URL` al arrancar (URL malformada, puerto inválido)
