# Feature: Galería pública de proyecto — publicar un portfolio con enlace

## Historia de usuario

Como fotógrafo que cura proyectos en photoshelf,
quiero publicar un proyecto como galería web navegable mediante un enlace,
para enseñar mi portfolio a clientes o amigos sin darles acceso a la app ni enviarles un ZIP.

---

## Descripción

Los proyectos (US del módulo Portfolio) son selecciones curadas con título, statement y orden narrativo — exactamente lo que un fotógrafo quiere enseñar. Hoy la única forma de compartir es el enlace de descarga ZIP (US-092), que entrega ficheros pero no la experiencia: ni orden, ni statement, ni presentación.

Esta feature añade «Publicar» a un proyecto: genera un token persistente (revocable, sin caducidad de 72 h) que sirve una galería pública de solo lectura en `/p/[token]` — título, statement y las fotos en su orden, con lightbox simple. Las imágenes se sirven como thumbnails de 1920 px (nunca originales) reutilizando la caché existente.

Reutiliza la infraestructura de `share_tokens` con un tipo nuevo, y el patrón de página pública del endpoint de descarga (excluida del middleware de auth).

---

## Criterios de aceptación

### Publicar y revocar
- [ ] Botón «Publicar» en el detalle del proyecto genera el enlace y lo muestra en un diálogo (copiar al portapapeles)
- [ ] Un proyecto publicado muestra su estado y permite «Despublicar» (revoca el token)
- [ ] Republicar genera un token nuevo (el viejo deja de funcionar)

### Galería pública
- [ ] `/p/[token]` renderiza título, statement y fotos en el orden del proyecto, sin requerir sesión
- [ ] Lightbox con navegación por teclado y swipe móvil
- [ ] Las imágenes servidas son thumbnails (máx. 1920, sin EXIF/GPS) — nunca el fichero original
- [ ] Token inválido o revocado → página de error amable (patrón del share existente)

### Seguridad
- [ ] La ruta pública y sus imágenes quedan excluidas del middleware de auth de forma explícita y acotada
- [ ] El endpoint de imagen pública solo sirve fotos que pertenecen a un proyecto publicado (no acepta IDs arbitrarios)
- [ ] `robots.txt` / meta noindex en la galería

---

## API necesaria

- `POST /api/projects/[id]/publish` — crea/rota el token
- `DELETE /api/projects/[id]/publish` — revoca
- `GET /p/[token]` — página pública (route handler o page)
- `GET /p/[token]/photo/[photoId]` — imagen pública validada contra el proyecto

---

## Ruta y navegación

- Nueva ruta pública `/p/[token]` fuera del app-shell (sin sidebar/header)
- Botón «Publicar» en `/projects/[id]`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/p/[token]/page.tsx` | Galería pública |
| `src/app/projects/[id]/ProjectDetailClient.tsx` | Botón publicar + estado |
| `src/lib/queries/share.ts` | Tokens tipo `gallery` sin expiración |
| `src/middleware.ts` | Exclusión de `/p/*` |

---

## Notas técnicas

- Añadir columna `kind` a `share_tokens` (`'download'` default, `'gallery'`) con migración idempotente, o tabla `project_publications` separada — decidir en implementación (la tabla separada evita tocar la limpieza de tokens caducados).
- El endpoint de imagen pública valida: token activo → proyecto → `photo_id ∈ project_photos`. Cachear la lista de IDs por token en memoria con TTL corto.

---

## Fuera de alcance (v1)

- Protección por contraseña de la galería
- Estadísticas de visitas
- Personalización visual (temas, logo)
- Descarga desde la galería (para eso está US-092)
