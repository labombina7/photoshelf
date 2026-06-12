# Feature: Robustez de enlaces compartidos — no quemar el token antes de completar la descarga

> Estado: ✅ Desplegada

## Historia de usuario

Como destinatario de un enlace de fotos compartidas,
quiero poder reintentar la descarga si se corta a la mitad,
para no tener que pedir al propietario que genere y reenvíe un enlace nuevo.

---

## Descripción

El tech debt audit del 2026-06-12 detectó que el endpoint público de descarga (`src/app/share/[token]/route.ts:66-67`) ejecuta `markShareTokenUsed(token)` **antes** de empezar el streaming del ZIP. Los ZIP van sin comprimir (nivel 0, correcto para JPEG) y con hasta 300 fotos pueden superar el gigabyte — en una red móvil las descargas interrumpidas son habituales. Hoy, un corte a mitad de descarga deja el enlace de uso único consumido y la página muestra «Este enlace ya fue utilizado».

El marcado temprano existe para rechazar peticiones concurrentes (razonable), así que la solución debe mantener esa protección sin penalizar los reintentos legítimos.

---

## Criterios de aceptación

### Ventana de reintentos
- [ ] Tras el primer uso, el token permite reintentos durante una ventana corta (p. ej. 60 min desde `used_at`) en lugar de bloquearse instantáneamente
- [ ] Pasada la ventana (o al alcanzar la caducidad de 72 h), el token queda inutilizable como hasta ahora
- [ ] Las descargas concurrentes simultáneas siguen permitidas dentro de la ventana (no hay estado corrupto: el ZIP se genera por petición)

### Feedback
- [ ] La página de error distingue «enlace caducado» de «ventana de descarga agotada»
- [ ] El ShareDialog actualiza su copy: «Válido 72 horas · ventana de descarga de 1 hora tras el primer uso» (o el valor final elegido)

### Tests
- [ ] Test de `getShareToken`/`markShareTokenUsed` con la nueva semántica de ventana
- [ ] Test del endpoint: segundo GET dentro de la ventana → 200; fuera → 410

---

## API necesaria

- `GET /share/[token]` — misma ruta; cambia la condición de rechazo de `used_at !== null` a `used_at !== null && now > used_at + RETRY_WINDOW`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/share/[token]/route.ts` | Nueva condición de ventana |
| `src/lib/queries/share.ts` | Semántica de `used_at` + constante de ventana |
| `src/lib/config.ts` | `SHARE_RETRY_WINDOW_MINUTES` |
| `src/components/ShareDialog.tsx` | Copy actualizado |

---

## Notas técnicas

- Alternativa considerada y descartada: marcar como usado al evento `finish` del stream — el servidor no puede distinguir de forma fiable si el cliente recibió todos los bytes (el `close` llega también en aborts), y deja una carrera con peticiones concurrentes. La ventana de reintentos es más simple y predecible.
- No requiere migración de esquema: `used_at` ya almacena unixepoch.

---

## Fuera de alcance (v1)

- Contador máximo de descargas por enlace
- Soporte de resumición HTTP Range del ZIP (el ZIP se genera al vuelo, no es seekeable)
