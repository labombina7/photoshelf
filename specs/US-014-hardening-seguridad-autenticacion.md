# Feature: Hardening de seguridad en autenticación

## Historia de usuario

Como operador de photoshelf que despliega la app en un NAS expuesto a internet,
quiero que la app falle al arrancar si las variables de seguridad no están configuradas y que el login tenga rate limiting,
para no dejar la instalación vulnerable por un descuido de configuración.

---

## Descripción

El audit de deuda técnica identificó cuatro problemas de seguridad en la capa de autenticación que deben resolverse antes del próximo release. El más grave es la contraseña de sesión hardcodeada como fallback: si `SESSION_SECRET` no está configurado, cualquiera que conozca el código puede forjar cookies de sesión válidas. El segundo es la ausencia de rate limiting en el endpoint de login, que permite fuerza bruta sin restricciones.

Adicionalmente, el prompt de búsqueda semántica se inserta literalmente en el texto enviado a Ollama sin sanitización, y la variable `APP_PASSWORD` no se valida al arrancar (una app sin contraseña bloqueará todos los accesos sin dar ninguna advertencia).

Esta US cubre el "Sprint 1 crítico" del plan de resolución del tech debt audit en lo que respecta a autenticación y configuración de seguridad.

---

## Criterios de aceptación

### Validación al arranque
- [ ] Si `SESSION_SECRET` no está definido como variable de entorno (o es la cadena vacía), la app lanza un error al arrancar: `Error: SESSION_SECRET environment variable must be set to a secure random string`
- [ ] Si `APP_PASSWORD` no está definido o es vacío, la app lanza un error: `Error: APP_PASSWORD environment variable must be set`
- [ ] La validación ocurre en el momento de inicialización (en `instrumentation.ts` o en el módulo `session.ts` al ser importado por primera vez)
- [ ] En entorno de test (`NODE_ENV=test`), la validación puede omitirse para no romper los tests

### Eliminación del fallback inseguro
- [ ] `src/lib/session.ts` no tiene ningún valor por defecto para `SESSION_SECRET` (eliminar `'default-dev-secret-change-in-production!!'`)
- [ ] La función `getIronSessionOptions()` lanza excepción si `SESSION_SECRET` es `undefined`

### Rate limiting en login
- [ ] El endpoint `POST /api/auth/login` implementa rate limiting basado en IP: máximo 10 intentos en una ventana de 15 minutos
- [ ] Si se supera el límite, el endpoint devuelve HTTP 429 con body `{ error: 'Demasiados intentos. Espera 15 minutos.' }`
- [ ] El contador se resetea tras un login exitoso
- [ ] La implementación usa un mapa en memoria (`Map<string, { count: number; resetAt: number }>`) — no requiere Redis ni base de datos
- [ ] La IP se extrae del header `x-forwarded-for` (para setups detrás de reverse proxy) con fallback a la IP directa

### Sanitización de prompt injection
- [ ] En `src/lib/ollama.ts`, el `prompt` del usuario se inserta en el texto de Ollama delimitado con etiquetas XML: `<user_query>${escapeXml(prompt)}</user_query>` en lugar de interpolación directa entre comillas
- [ ] Se crea una función `escapeXml(str: string): string` que escapa `<`, `>`, `"`, `'` y `&`
- [ ] En `src/app/api/ai/search/route.ts`, el parámetro `q` de la query se valida: longitud máxima de 200 caracteres, se recorta si es más largo

### Import estático de crypto
- [ ] `src/lib/session.ts` usa `import crypto from 'crypto'` al inicio del módulo en lugar de `require('crypto')` dentro de la función `checkPassword`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/lib/session.ts` | Eliminar fallback, import estático de crypto, validación al inicializar |
| `src/instrumentation.ts` | Verificar `SESSION_SECRET` y `APP_PASSWORD` al arranque (o crear si no existe) |
| `src/app/api/auth/login/route.ts` | Añadir rate limiting en memoria |
| `src/lib/ollama.ts` | Sanitización de prompt con `escapeXml`, delimitación con etiquetas XML |
| `src/app/api/ai/search/route.ts` | Validación de longitud del parámetro `q` |

---

## Notas técnicas

- El mapa de rate limiting en memoria se pierde al reiniciar el servidor. Para un NAS personal con un solo usuario esto es aceptable; si se necesita persistencia, usar SQLite (tabla `rate_limits`).
- `instrumentation.ts` es el hook de Next.js que se ejecuta al arrancar el servidor (una sola vez). Si no existe, crear el archivo mínimo con la validación.
- `x-forwarded-for` puede contener múltiples IPs separadas por coma (ej. `"203.0.113.1, 10.0.0.1"`); usar la primera IP de la lista.
- La sanitización de prompts no impide que Ollama genere respuestas inesperadas, pero sí dificulta los ataques de inyección más simples. Una protección completa requeriría un output parser más robusto.

---

## Fuera de alcance (v1)

- Autenticación multi-factor (2FA)
- Soporte de múltiples usuarios con roles
- Rate limiting persistente en SQLite o Redis
- Protección CSRF explícita con tokens en formularios (cubierto parcialmente por cookies `httpOnly`)
- Auditoría de logs de intentos de login
