# Feature: Actualización de Next.js 14 → Next.js 15

> Estado: ✅ Desplegada

## Historia de usuario

Como administrador de photoshelf,
quiero que la app use la última versión estable de Next.js,
para beneficiarme de las mejoras de rendimiento y no acumular CVEs conocidos.

---

## Descripción

La app usa Next.js 14. Next.js 15 incluye mejoras en el App Router, mejor soporte de React 19,
mejoras de rendimiento en el renderizado estático y correcciones de CVEs presentes en Next.js 14.
La migración es más sencilla ahora que en el futuro, especialmente antes de añadir más páginas
y rutas (EPIC-001, EPIC-002).

Los breaking changes conocidos de Next.js 15 que afectan a esta app:
- `cookies()` y `headers()` son ahora asíncronas (requieren `await`) — photoshelf ya hace `await cookies()` ✓
- `params` en route handlers y páginas son ahora Promises — algunos route handlers necesitan `await params`
- Cambios en la configuración de `next.config.js`

---

## Criterios de aceptación

### Migración exitosa
- [ ] `package.json` actualiza `next` a la versión 15.x más reciente
- [ ] `npm run build` completa sin errores ni warnings de deprecación
- [ ] `npm run dev` arranca correctamente
- [ ] Todos los tests existentes pasan

### Breaking changes corregidos
- [ ] Todos los `params` en route handlers que eran `{ params: { id: string } }` son ahora
  `{ params: Promise<{ id: string }> }` y usan `await params`
- [ ] Los `searchParams` en páginas que eran síncronos son ahora `Promise<{...}>` y usan `await`
- [ ] El archivo `next.config.js`/`next.config.ts` no usa opciones eliminadas en v15

### Validación funcional
- [ ] La vista de Timeline carga correctamente
- [ ] La autenticación (login/logout) funciona correctamente
- [ ] El endpoint de thumbnail devuelve imágenes correctamente
- [ ] El scan de fotos funciona correctamente
- [ ] El mapa de fotos carga los marcadores

---

## Notas técnicas

- Usar el codemod oficial: `npx @next/codemod@canary upgrade latest` para automatizar algunos cambios
- Revisar el changelog de Next.js 15 en https://nextjs.org/blog/next-15 antes de la migración
- React 19 puede requerir actualizar también `react` y `react-dom` a v19
- Probar en rama separada (`chore/nextjs-15-upgrade`) para poder hacer rollback fácilmente

### Pasos de migración recomendados
1. Crear rama `chore/nextjs-15-upgrade`
2. Correr `npx @next/codemod@canary upgrade latest`
3. Revisar y corregir los cambios del codemod
4. Correr `npm run build` y corregir errores de tipo
5. Probar manualmente las funcionalidades críticas
6. Abrir PR con el resultado

---

## Fuera de alcance (v1)

- Migración a Turbopack como bundler de producción (puede hacerse en paralelo)
- Adopción de nuevas APIs de Next.js 15 (p. ej. Partial Prerendering)
- Actualización de otras dependencias mayores (React 19, TypeScript 5.x)
