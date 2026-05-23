# Feature: Actualización a Next.js 15 LTS

## Historia de usuario

Como operador de photoshelf,
quiero que la app use Next.js 15 LTS en lugar de 14.2.x,
para estar en una versión con soporte activo, parches de seguridad y mejor rendimiento.

---

## Descripción

photoshelf usa Next.js 14.2.35, una versión de la rama 14.x que ya no es la versión con soporte activo. Next.js 15 es la versión LTS actual con soporte a largo plazo, mejoras de rendimiento (Turbopack estable, React 19 support) y parches de seguridad continuos. La migración es recomendable antes de acumular más deuda de dependencias.

Los principales cambios breaking de Next.js 15 que afectan al codebase son: `cookies()` y `headers()` son ahora async, `params` en page/layout components es ahora una Promise (requiere `await params`), y algunos comportamientos del caché han cambiado. Revisando el código existente, varios Server Components ya usan `await params` correctamente (visible en el uso de `async/await` en las page functions), lo que simplifica la migración.

---

## Criterios de aceptación

### Actualización de la dependencia
- [ ] `package.json` actualiza `"next": "15.x.x"` (la última versión estable de Next.js 15)
- [ ] `npm install` (o `npm ci`) completa sin errores
- [ ] El build de producción (`npm run build`) completa sin errores de compilación

### Compatibilidad con cambios breaking de Next.js 15
- [ ] Todas las llamadas a `cookies()` en Server Components usan `await cookies()`
- [ ] Todas las llamadas a `headers()` usan `await headers()`
- [ ] Todos los `params` y `searchParams` en `page.tsx` y `layout.tsx` usan `await params` / `await searchParams` (o son destructurados después de await)
- [ ] No hay warnings de deprecación en los logs del servidor relacionados con APIs de Next.js

### Tests y verificación funcional
- [ ] `npm run dev` arranca sin errores
- [ ] Las rutas principales funcionan: `/library`, `/timeline`, `/map`, `/stats`, `/tags`, `/projects`
- [ ] El login y la sesión funcionan correctamente
- [ ] El scan de biblioteca se completa sin errores
- [ ] Los thumbnails y la imagen original se sirven correctamente
- [ ] El Docker build (`docker build`) completa sin errores

### Docker image actualizada
- [ ] El `Dockerfile` usa la imagen base compatible con Next.js 15 (verificar que no haya pins a versiones específicas de Node que sean incompatibles)
- [ ] La imagen resultante funciona en el entorno de producción (NAS)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `package.json` | Actualizar versión de `next` a 15.x |
| `package-lock.json` | Regenerar con nueva versión |
| `src/app/**/page.tsx` | Actualizar `params`/`searchParams` a async si es necesario |
| `src/app/**/layout.tsx` | Actualizar si usa `params` |
| `Dockerfile` | Verificar compatibilidad con Next.js 15 standalone output |

---

## Notas técnicas

- Ejecutar `npx @next/codemod@latest upgrade` puede automatizar parte de la migración (convierte `cookies()`, `headers()`, `params` async automáticamente).
- Verificar en la [guía de migración oficial de Next.js 15](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) todos los cambios breaking aplicables.
- El output `standalone` del Dockerfile sigue siendo compatible con Next.js 15; no se esperan cambios en la estructura del build.
- React 19 es opcional en Next.js 15 (se puede quedarse en React 18 durante la migración). Recomendamos mantenerse en React 18 para esta US y hacer la migración a React 19 en un paso separado.
- `better-sqlite3` y `sharp` son dependencias nativas; verificar que no haya incompatibilidades con la versión de Node.js que use Next.js 15.

---

## Fuera de alcance (v1)

- Migración a React 19 (puede hacerse como paso posterior)
- Adopción de Turbopack en producción (sigue siendo experimental en algunas configuraciones)
- Migración a las nuevas APIs de caché de Next.js 15 (`unstable_cache`, `use cache`)
- Actualización de otras dependencias mayores (sharp, better-sqlite3) en el mismo PR
