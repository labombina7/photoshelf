# Feature: Cobertura de tests — scanner, thumbnail y rutas API críticas

> Estado: ✅ Desplegada

## Historia de usuario

Como desarrollador de photoshelf,
quiero tener tests automatizados para los módulos más críticos del backend,
para poder refactorizar con confianza y detectar regresiones antes de desplegar.

---

## Descripción

El codebase no tiene tests automatizados en los módulos más importantes:
`src/lib/scanner.ts` (indexación de fotos), `src/lib/thumbnail.ts` (generación de thumbnails),
`src/lib/ollama.ts` (integración con IA) y las rutas API más críticas (auth, scan, photos).

La ausencia de tests hace que cada refactoring sea una apuesta y que los bugs de regresión
sólo se detecten manualmente en producción.

Esta US establece la infraestructura de testing y añade cobertura mínima en los módulos críticos.

---

## Criterios de aceptación

### Infraestructura
- [ ] Se configura **Vitest** (o Jest) como framework de tests (`npm test`)
- [ ] Se configura `@testing-library/react` para tests de componentes React
- [ ] Existe un script `npm run test:coverage` que genera reporte de cobertura
- [ ] Los tests corren en CI (GitHub Actions o equivalente) en cada PR

### Tests de `src/lib/scanner.ts`
- [ ] Test: el scanner indexa correctamente una foto JPEG con EXIF de fecha y coordenadas
- [ ] Test: el scanner ignora archivos no-imagen (`.txt`, `.mp4`)
- [ ] Test: el scanner no duplica fotos ya indexadas (por `path`)
- [ ] Test: el scanner maneja fotos sin EXIF (fecha NULL, coords NULL)

### Tests de `src/lib/thumbnail.ts`
- [ ] Test: genera un WebP de las dimensiones correctas para un JPEG de entrada
- [ ] Test: sirve desde caché cuando el thumbnail ya existe en disco
- [ ] Test: lanza error en path traversal (usando `resolvePhotoPath`)

### Tests de `src/lib/config.ts`
- [ ] Test: `resolvePhotoPath` acepta rutas válidas dentro del root
- [ ] Test: `resolvePhotoPath` rechaza rutas con `..` que escapen el root
- [ ] Test: `resolvePhotoPath` rechaza rutas absolutas externas

### Tests de rutas API (integración light)
- [ ] Test: `POST /api/auth/login` con contraseña correcta → 200 + sesión
- [ ] Test: `POST /api/auth/login` con contraseña incorrecta → 401
- [ ] Test: `POST /api/auth/login` tras 10 intentos → 429
- [ ] Test: endpoints protegidos sin sesión → 401

---

## Componentes nuevos

| Archivo | Descripción |
|---|---|
| `vitest.config.ts` | Configuración de Vitest |
| `src/lib/__tests__/config.test.ts` | Tests de resolvePhotoPath |
| `src/lib/__tests__/scanner.test.ts` | Tests del escáner |
| `src/lib/__tests__/thumbnail.test.ts` | Tests de thumbnail |
| `src/app/api/auth/__tests__/login.test.ts` | Tests de auth y rate limiting |

---

## Notas técnicas

- Para tests del scanner y thumbnail, usar fixtures en `src/__tests__/fixtures/` (fotos JPEG pequeñas de muestra)
- Mockear `sharp` y `heic-convert` con mocks de Vitest para no requerir binarios nativos en CI
- Mockear Ollama con `vi.mock('../lib/ollama')` — no hacer llamadas reales en tests
- La DB de tests usar SQLite in-memory (`:memory:`) para aislamiento
- Apuntar a cobertura de líneas ≥ 70% en los módulos críticos como objetivo inicial

---

## Fuera de alcance (v1)

- Tests E2E con Playwright (interfaz de usuario)
- Tests de performance/carga
- Tests de componentes React complejos (PhotoGrid, DetailPanel)
- 100% de cobertura — foco en paths críticos y casos de error
