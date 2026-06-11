# Feature: Logging de errores silenciosos — catch vacíos y checkPassword

## Historia de usuario

Como operador de photoshelf,
quiero que todos los errores inesperados queden registrados en los logs aunque no sean fatales,
para poder diagnosticar problemas de clientes o intentos de seguridad sin tener que reproducirlos.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó cuatro puntos donde las excepciones se capturan sin dejar traza alguna:

**1. Cursor corrupto en `v1/timeline/[periodKey]/photos`** (`route.ts:42`): si el cursor base64 llega mal formado, `catch {}` silencia la excepción y la ruta devuelve los primeros resultados sin cursor. El comportamiento es razonablemente seguro, pero si un cliente tiene un bug que genera cursores inválidos, no hay forma de saberlo en los logs.

**2. Cursor corrupto en `v1/timeline`** (`route.ts:40`): idéntico al anterior para los cursores de períodos.

**3. Path traversal sin log en `v1/photos/[id]/original`** (`route.ts:44`): cuando `resolvePhotoPath` detecta un intento de path traversal y lanza, el `catch` devuelve `403 Forbidden` al cliente pero no registra ningún log. Cualquier intento real de ataque pasa completamente desapercibido.

**4. `checkPassword` con `catch` vacío** (`src/lib/session.ts:41-47`): la comparación de relleno para timing attacks tiene un `try/catch {}` vacío. Si `Buffer.from` lanza con una entrada problemática, el error se silencia y la función retorna `false` sin traza, dificultando el diagnóstico de inputs anómalos.

Los cuatro fixes son de una línea cada uno: añadir `console.warn` o `console.error` en el bloque catch correspondiente.

---

## Criterios de aceptación

### Cursores de timeline
- [ ] En `v1/timeline/[periodKey]/photos/route.ts`, el `catch` de decodificación de cursor añade `console.warn('[timeline-photos] Invalid cursor, ignoring:', cursor)`
- [ ] En `v1/timeline/route.ts`, el `catch` añade `console.warn('[timeline] Invalid cursor, ignoring:', cursor)`
- [ ] El comportamiento ante cursor inválido sigue siendo el mismo (devolver primera página)

### Path traversal
- [ ] En `v1/photos/[id]/original/route.ts`, el `catch` de `resolvePhotoPath` añade `console.error('[security] Path traversal attempt blocked, photo id:', id)` antes de devolver el `403`

### checkPassword
- [ ] El `try/catch` vacío en `session.ts` añade `console.error('[session] checkPassword comparison error:', e)` en el catch
- [ ] Alternativamente, se simplifica la función: si `!expected` retornar `false` directamente sin la comparación de relleno (el timing attack de longitud es aceptable cuando el secret está vacío, porque la configuración ya es inválida)
- [ ] Los tests existentes de sesión siguen pasando

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/v1/timeline/[periodKey]/photos/route.ts` | Añadir warn en catch de cursor |
| `src/app/api/v1/timeline/route.ts` | Añadir warn en catch de cursor |
| `src/app/api/v1/photos/[id]/original/route.ts` | Añadir error log en catch de path traversal |
| `src/lib/session.ts` | Añadir log en catch vacío de checkPassword |

---

## Notas técnicas

- Ningún cambio de comportamiento observable para el usuario final
- Los logs de path traversal deben usar `console.error` (son eventos de seguridad), los de cursor inválido `console.warn` (son errores de cliente)
- Mantener la convención de prefijo `[nombre-ruta]` en todos los logs

---

## Fuera de alcance (v1)

- Alertas o métricas sobre intentos de path traversal (requeriría sistema de observabilidad externo)
- Rate limiting sobre intentos de autenticación fallidos

> Estado: ✅ Desplegada
