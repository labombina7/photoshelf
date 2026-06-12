# Feature: Suite de tests en verde y gate de calidad en CI

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador de photoshelf,
quiero que la suite de tests pase y que el CI bloquee la publicación de imágenes cuando los tests fallen,
para que main sea siempre desplegable y las regresiones se detecten antes de llegar al NAS.

---

## Descripción

El tech debt audit del 2026-06-12 ejecutó la suite y encontró **21 tests fallando de 244** (14 suites rojas). Dos causas:

1. **Mock de sharp desactualizado**: `detectIsBlackAndWhite` (`src/lib/ollama/image.ts:30`) usa `.removeAlpha()`, que el mock de los tests no implementa — rompe `ollama.test.ts`, `scanner.test.ts` y `thumbnail.test.ts`.
2. **Tests del clasificador de intención obsoletos**: los asserts de `classifier.test.ts` esperan el comportamiento antiguo de `classifyQuery` (rango de años, detección por nº de palabras, signos de interrogación).

Nadie lo nota porque el único workflow (`.github/workflows/build.yml`) construye y publica la imagen Docker a `ghcr.io:latest` en cada push a main **sin ejecutar tests ni lint** — una imagen rota puede publicarse y el NAS la consume.

---

## Criterios de aceptación

### Suite en verde
- [ ] El mock de sharp implementa la cadena completa usada en producción (`resize`, `removeAlpha`, `raw`, `toBuffer`, `webp`, `rotate`)
- [ ] Los tests de `classifyQuery` reflejan el comportamiento actual del clasificador (revisar caso a caso si el cambio fue intencional o es un bug)
- [ ] `npx vitest run` termina con 0 fallos
- [ ] El test de `parseSearchQuery` (status no-ok) pasa

### Gate de CI
- [ ] Job `test` en GitHub Actions: `npm ci` + `vitest run` + `next lint` + `tsc --noEmit`
- [ ] El job de build/push de Docker declara `needs: test` — sin tests verdes no se publica imagen
- [ ] El workflow corre también en pull requests (no solo push a main)

### Prevención
- [ ] El README documenta que `npm test` debe pasar antes de mergear

---

## Notas técnicas

- Al actualizar los asserts del clasificador, comparar contra `src/lib/search/classifier.ts` actual y la spec de EPIC-003 — si el comportamiento divergió de la spec, el fix es el código, no el test.
- Considerar publicar también tags versionados (`:sha-XXXX`) además de `:latest`, para poder hacer rollback en el NAS.

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/__tests__/ollama.test.ts` | Mock de sharp completo |
| `src/lib/__tests__/scanner.test.ts`, `thumbnail.test.ts` | Ídem |
| `src/lib/__tests__/classifier.test.ts` | Asserts actualizados |
| `.github/workflows/build.yml` | Job `test` como gate del build |

---

## Fuera de alcance (v1)

- Aumentar cobertura (ya cubierto por US-019/US-048/US-083)
- Tests E2E con navegador
