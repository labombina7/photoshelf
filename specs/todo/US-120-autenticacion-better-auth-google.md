# Feature: Autenticación con better-auth + Google OAuth

## Historia de usuario

Como usuario de photoshelf,
quiero autenticarme con mi cuenta de Google,
para acceder a la app sin depender de una contraseña definida en el servidor ni del sistema de archivos del NAS.

---

## Descripción

El sistema de autenticación actual almacena una única contraseña en `.env` y la comprueba en `src/lib/session.ts` mediante `iron-session`. Esto acopla el acceso a la app con la configuración del servidor y no es extensible.

Se reemplaza por **better-auth** con el provider de Google OAuth. La sesión pasa a estar respaldada por SQLite (tablas `user`, `session`, `account` gestionadas por better-auth). El sistema queda preparado para añadir más providers o usuarios en el futuro sin cambios de arquitectura.

La implementación mínima inicial es: un único usuario autorizado (el propietario), autenticado exclusivamente via Google. No hay registro público.

---

## Criterios de aceptación

### Autenticación
- [ ] El usuario puede iniciar sesión con su cuenta de Google desde la página de login
- [ ] Tras el login, la sesión persiste en SQLite (no en cookie cifrada con secret)
- [ ] El logout invalida la sesión en BD y redirige al login
- [ ] Las rutas protegidas siguen requiriendo sesión válida — comportamiento idéntico al actual

### Seguridad
- [ ] Solo el email autorizado (definido en `.env` como `ALLOWED_EMAIL`) puede acceder — el resto recibe 403
- [ ] No hay endpoint de registro público
- [ ] Las credenciales de Google OAuth (client id + secret) se leen de `.env`, nunca hardcodeadas

### Limpieza
- [ ] `iron-session` eliminado de dependencias
- [ ] La variable `AUTH_PASSWORD` del `.env` eliminada (o marcada como deprecated en `.env.example`)
- [ ] `src/lib/session.ts` reemplazado por el cliente/helpers de better-auth

### Verificación
- [ ] Flujo completo funciona en local: login → app → logout → redirige a login
- [ ] Acceso con email no autorizado muestra error claro, no 500

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/lib/auth.ts` | Configuración central de better-auth (Google provider, SQLite adapter) |
| `src/lib/auth-client.ts` | Cliente de better-auth para componentes React |
| `src/lib/session.ts` | Eliminado — reemplazado por helpers de `auth.ts` |
| `src/app/api/auth/[...all]/route.ts` | Handler catch-all de better-auth |
| `src/app/login/page.tsx` | Botón «Continuar con Google» en lugar del formulario de password |
| `src/middleware.ts` | Actualizar comprobación de sesión al nuevo sistema |
| `.env.example` | Nuevas variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL`, `BETTER_AUTH_SECRET` |

---

## Notas técnicas

- **better-auth** crea automáticamente las tablas `user`, `session`, `account` en SQLite al arrancar — no requiere migración manual
- El `BETTER_AUTH_SECRET` reemplaza al `SECRET_COOKIE_PASSWORD` de iron-session — debe ser un string aleatorio largo
- La restricción de email (`ALLOWED_EMAIL`) se implementa con el hook `user.create` de better-auth, que permite rechazar el registro de emails no autorizados antes de que se cree la cuenta
- Considerar añadir `BETTER_AUTH_URL` en `.env` para que better-auth resuelva correctamente los callbacks en producción/Docker

## Google OAuth setup (prerequisito)

Antes de implementar, el usuario debe:
1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilitar la API de Google OAuth
3. Crear credenciales OAuth 2.0 (tipo «Web application»)
4. Añadir `http://localhost:3000/api/auth/callback/google` como URI de redirección autorizado (y la URL de producción si aplica)

---

## Fuera de alcance (v1)

- Múltiples usuarios con roles/permisos distintos
- Otros providers (GitHub, Apple, magic link…) — la arquitectura los soporta pero no se implementan
- Admin panel de gestión de usuarios
- Audit log de accesos

---

## Dependencias

- `better-auth` — librería principal
- Google Cloud project con OAuth 2.0 configurado (prerequisito manual)
