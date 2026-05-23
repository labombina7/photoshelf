# Feature: Hardening de seguridad — autenticación y protección de sesión

> **Estado: ✅ Desplegada** — merged en main el 2026-05-23 (PR #34)

## Historia de usuario

Como administrador de photoshelf,
quiero que la autenticación sea robusta y resistente a ataques de fuerza bruta,
para que mis fotos personales no sean accesibles por terceros aunque la app esté expuesta a internet.

---

## Descripción

La app actual tiene varias debilidades de seguridad en la capa de autenticación:

1. **`SESSION_SECRET` hardcodeado**: si no se define la variable de entorno, la sesión usa un valor
   fijo conocido, permitiendo a cualquiera forjar cookies de sesión válidas.
2. **Sin rate limiting en login**: el endpoint `/api/auth/login` acepta intentos ilimitados,
   exponiendo la app a ataques de diccionario o fuerza bruta sobre `APP_PASSWORD`.
3. **Comparación de contraseña sin timing-safe**: una comparación directa de strings es vulnerable
   a timing attacks.
4. **`require('crypto')` dinámico**: patrón de importación inconsistente con el resto del codebase.

Esta US corrige todos estos puntos con cambios mínimos y de bajo riesgo.

---

## Criterios de aceptación

### Validación de SESSION_SECRET en arranque
- [ ] Si `SESSION_SECRET` no está definida en producción/desarrollo, el servidor lanza un error
  claro al arrancar (`instrumentation.ts`) en lugar de usar el valor hardcodeado
- [ ] El mensaje de error incluye el comando para generar un secreto: `openssl rand -hex 32`
- [ ] En entorno `test`, la validación se omite para no romper los tests

### Rate limiting en login
- [ ] El endpoint `POST /api/auth/login` limita a **10 intentos** por IP en una ventana de **15 minutos**
- [ ] Al superar el límite, devuelve HTTP 429 con el mensaje: "Demasiados intentos. Espera 15 minutos."
- [ ] El contador se resetea al hacer login con éxito
- [ ] La implementación usa un `Map<ip, {count, resetAt}>` en memoria (sin Redis)

### Timing-safe password comparison
- [ ] `checkPassword()` usa `crypto.timingSafeEqual()` para la comparación
- [ ] Si `APP_PASSWORD` no está definida, la función devuelve `false` sin timing leak
- [ ] La función tiene longitud-safe: si los strings tienen distinta longitud, no hay early exit antes de la comparación

### Mejoras de código
- [ ] `require('crypto')` se reemplaza por `import crypto from 'crypto'` estático
- [ ] `APP_PASSWORD` se valida en `instrumentation.ts` al arranque

---

## Componentes modificados

| Archivo | Cambio |
|---|---|
| `src/lib/session.ts` | `checkPassword()` con `timingSafeEqual`, import estático de crypto |
| `src/instrumentation.ts` | Validación de `SESSION_SECRET` y `APP_PASSWORD` al arranque |
| `src/app/api/auth/login/route.ts` | Rate limiting con Map en memoria |

---

## Notas técnicas

- El rate limiting en memoria se pierde al reiniciar el proceso. Es suficiente para el caso de uso
  (NAS personal); para mayor robustez considerar redis en el futuro
- La IP del cliente se extrae del header `x-forwarded-for` (primer valor) o `x-real-ip`
- `timingSafeEqual` requiere buffers de igual longitud — si los strings difieren en longitud,
  se hace padding con `\0` para la comparación pero el resultado forzado es `false`

---

## Fuera de alcance (v1)

- Autenticación multi-factor (TOTP)
- Blacklist de IPs permanente
- Rate limiting distribuido (Redis)
- Logs de auditoría de intentos de login
