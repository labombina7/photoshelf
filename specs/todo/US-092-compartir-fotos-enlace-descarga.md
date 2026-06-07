# Feature: Compartir fotos mediante enlace de descarga

## Historia de usuario

Como fotógrafo que usa photoshelf desde móvil,
quiero seleccionar fotos o álbumes completos y generar un enlace de descarga directo,
para compartirlos con familia o clientes (por WhatsApp u otras apps) sin que el destinatario necesite tener cuenta en photoshelf.

---

## Descripción

photoshelf vive en una red privada o NAS del usuario. Los destinatarios de una foto no tienen acceso a esa red. Esta feature añade un mecanismo de **share tokens**: el servidor genera un token temporal, crea un ZIP de las fotos seleccionadas y lo almacena (o lo genera bajo demanda al acceder al enlace), y sirve ese ZIP a cualquiera que tenga el token — sin autenticación.

El flujo completo desde móvil:
1. El usuario selecciona fotos o un álbum en la app web.
2. Pulsa "Compartir" → el servidor genera un share token y devuelve la URL pública.
3. La app invoca la **Web Share API** del navegador (`navigator.share`) para abrir el menú nativo de iOS/Android con la URL.
4. El destinatario recibe el link, pulsa, y el ZIP empieza a descargarse directamente — sin login, sin cuenta.

---

## Criterios de aceptación

### Generación del enlace

- [ ] En modo selección de la biblioteca, además de "Descargar", existe el botón "Compartir enlace"
- [ ] Desde la vista de álbum, el menú de opciones incluye "Compartir álbum"
- [ ] Al pulsar, se llama a la API que crea un share token y devuelve la URL pública
- [ ] La URL tiene la forma `{host}/share/{token}` donde `token` es un UUID aleatorio de 32 chars
- [ ] El token es de **uso único** — se invalida automáticamente tras la primera descarga completada
- [ ] El token tiene además una expiración de **72 horas** como seguridad adicional (configurable en `src/lib/config.ts`)
- [ ] Se muestra un indicador de carga mientras se crea el token; cuando está listo, se invoca `navigator.share`
- [ ] Si `navigator.share` no está disponible (escritorio o browser sin soporte), se muestra la URL en un dialog con botón "Copiar enlace"

### Descarga pública (sin autenticación)

- [ ] `GET /share/{token}` es una ruta pública — no requiere sesión
- [ ] Si el token es válido, no ha expirado y no ha sido usado, la respuesta es el ZIP en streaming con `Content-Disposition: attachment; filename="photoshelf-share.zip"`
- [ ] Una vez que la transferencia completa con éxito, el token se marca como usado (`used_at`) y cualquier acceso posterior devuelve error
- [ ] Si el token ha expirado, ya fue usado, o no existe, se devuelve una página de error clara con el motivo: "Este enlace ya fue utilizado" o "Este enlace ha caducado"
- [ ] El ZIP incluye los archivos originales de las fotos seleccionadas al momento de crear el token
- [ ] El nombre de los archivos dentro del ZIP es el filename original (sin exponer rutas absolutas del NAS)

### Seguridad y límites

- [ ] Los tokens caducados se limpian de la BD en cada arranque del servidor y con un job de limpieza periódico (o en la próxima visita al enlace caducado)
- [ ] Un token solo permite descargar exactamente las fotos que se incluyeron al crearlo — no es posible manipular el token para obtener otras fotos
- [ ] Límite de 300 fotos por share token para proteger el servidor
- [ ] El token no revela IDs internos de fotos en la URL
- [ ] Opción para **revocar** un token manualmente desde la interfaz (lista de enlaces activos en ajustes, futura extensión)

### Compresión

- [ ] El ZIP usa compresión estándar (nivel `store` para RAW/JPEG grandes, `deflate` para el resto)
- [ ] Alternativamente, se puede ofrecer seleccionar la calidad: "Originales" vs "Comprimidas (web)" — la opción "comprimidas" exporta los thumbnails de alta resolución en lugar de los originales

---

## API necesaria

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `POST /api/share` | POST | Sí | Crea un share token para un conjunto de fotos o un álbum |
| `GET /share/[token]` | GET | No | Descarga pública del ZIP del token |
| `GET /api/share` | GET | Sí | Lista los tokens activos del usuario (para gestión) |
| `DELETE /api/share/[token]` | DELETE | Sí | Revoca un token activo |

### POST /api/share — Body

```typescript
{
  photoIds?: number[];   // selección manual
  albumId?: number;      // álbum completo (mutuamente excluyente con photoIds)
  label?: string;        // nombre descriptivo opcional para el enlace
}
```

### POST /api/share — Response

```typescript
{
  token: string;
  url: string;           // URL absoluta lista para compartir
  expiresAt: string;     // ISO 8601
  photoCount: number;
}
```

---

## Esquema de BD (nueva tabla)

```sql
CREATE TABLE share_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL UNIQUE,        -- UUID 32 chars
  photo_ids   TEXT NOT NULL,               -- JSON array de IDs
  label       TEXT,                        -- nombre descriptivo opcional
  created_at  INTEGER NOT NULL,            -- unix timestamp
  expires_at  INTEGER NOT NULL,            -- unix timestamp
  used_at     INTEGER                      -- timestamp de descarga; si no es NULL, el token está agotado
);
```

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/api/share/route.ts` | POST (crear token) + GET (listar tokens) |
| `src/app/api/share/[token]/route.ts` | DELETE (revocar) |
| `src/app/share/[token]/route.ts` | GET público — descarga ZIP en streaming |
| `src/lib/queries/share.ts` | CRUD de share_tokens + limpieza de expirados |
| `src/components/ShareButton.tsx` | Botón que llama a la API y luego a `navigator.share` |
| `src/components/ShareDialog.tsx` | Fallback para navegadores sin `navigator.share` |
| `src/app/library/LibraryClient.tsx` | Añadir ShareButton a la toolbar de selección |
| `src/app/albums/[id]/AlbumClient.tsx` | Añadir opción "Compartir álbum" en el menú |

---

## Notas técnicas

### Web Share API

```typescript
if (navigator.share) {
  await navigator.share({
    title: 'Fotos compartidas',
    text: `${photoCount} fotos`,
    url: shareUrl,
  });
} else {
  // mostrar ShareDialog con copiar al portapapeles
}
```

La Web Share API está disponible en Chrome Android, Safari iOS 12.1+, y Safari macOS 14+. En escritorio con Chrome se puede compartir pero la experiencia varía — el fallback de "Copiar enlace" cubre el resto.

### Generación del ZIP bajo demanda vs. precompilado

**Recomendado: bajo demanda (streaming)** — Al acceder al token, el servidor lee las fotos del NAS y genera el ZIP en streaming directamente a la respuesta HTTP. No requiere almacenamiento intermedio en disco. El inconveniente es que si el NAS es lento, la primera descarga puede tardar.

Alternativa: precompilar el ZIP al crear el token y guardarlo en `/tmp/photoshelf-shares/`. Más rápido para el destinatario, pero consume espacio en disco y complica la limpieza.

### Expiración

`SHARE_TOKEN_TTL_HOURS = 72` en `src/lib/config.ts`. La limpieza de tokens expirados se puede hacer en el middleware o en cada arranque del servidor con una query `DELETE WHERE expires_at < unixepoch()`.

---

## Relación con otras historias

- **US-050** (Exportar selección ZIP): descartada — esta US la sustituye completamente. El caso de uso de "descargar para mí" queda cubierto compartiendo el link contigo mismo.
- **EPIC-002** (API pública): los share tokens son rutas públicas que no usan la API key de EPIC-002 — son URLs de un solo uso para usuarios finales.

---

## Fuera de alcance (v1)

- Proteger el enlace con contraseña opcional
- Tokens multi-uso (ej. máximo 5 descargas antes de invalidarse)
- Notificación al propietario cuando alguien descarga su enlace
- Preview de las fotos en el link (página web intermedia antes de descargar) — deliberadamente fuera de alcance; el destinatario descarga directamente
- Compartir fotos individuales como imagen (sin ZIP) para preview en WhatsApp
