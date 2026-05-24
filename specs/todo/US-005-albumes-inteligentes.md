# Feature: Álbumes Inteligentes

## Historia de usuario

Como fotógrafo que filtra frecuentemente por las mismas combinaciones de criterios,
quiero guardar filtros como álbumes que se actualizan solos cuando llegan fotos nuevas,
para acceder a colecciones dinámicas sin tener que recordar y reaplicar los filtros manualmente.

---

## Descripción

Los **Álbumes inteligentes** son colecciones virtuales definidas por reglas de filtrado que se evalúan en tiempo real contra la base de datos. A diferencia de los Proyectos (curación manual estática), un álbum inteligente siempre muestra las fotos que cumplen sus criterios en el momento de consultarlo — incluso si han llegado fotos nuevas desde que se creó.

Ejemplos de álbumes útiles:
- "Todas mis fotos de montaña" → tag = "montaña"
- "Fotos de 2023 sin etiquetar" → año = 2023, sin tags
- "Favoritas con cámara Fuji" → favorita = sí, cámara LIKE "Fuji%"
- "Retratos de los últimos 2 años" → tag = "retrato", año >= actual-2

Los álbumes se gestionan desde una sección del sidebar y su página muestra el mismo grid de fotos de la biblioteca, usando la UI existente de `PhotoGrid`.

---

## Criterios de aceptación

### Creación de álbumes
- [ ] Botón "Nuevo álbum inteligente" en la sección "Álbumes" del sidebar
- [ ] Modal de creación con formulario de reglas (builder visual, no texto libre)
- [ ] Reglas disponibles en v1:
  - `año` = valor exacto o rango (desde / hasta)
  - `tag` contiene (uno o varios tags, condición OR)
  - `tema` = uno de los temas existentes
  - `favorita` = sí / no
  - `cámara` contiene (texto libre, case-insensitive)
  - `sin tags` (fotos sin ningún tag)
- [ ] Nombre del álbum: campo de texto libre obligatorio
- [ ] Vista previa en tiempo real: el modal muestra "X fotos coinciden" mientras el usuario define las reglas
- [ ] Botón "Guardar álbum" crea el álbum y navega a su vista

### Vista del álbum
- [ ] Ruta `/smart-albums/[id]` con el mismo grid de fotos que `/library`
- [ ] Topbar muestra el nombre del álbum y el número de fotos actuales
- [ ] El contador se actualiza cada vez que se visita (no está cacheado)
- [ ] El grid pagina igual que la biblioteca estándar (grupos por evento, colapsables)
- [ ] Enlace "Editar reglas" abre el modal de edición en el mismo lugar

### Gestión de álbumes
- [ ] Sección "Álbumes" en el sidebar lista los álbumes con nombre y contador
- [ ] Página `/smart-albums` muestra todos los álbumes con: nombre, reglas en lenguaje natural, foto de portada (primera foto), recuento
- [ ] Botón de borrar álbum (con confirmación) — solo borra el álbum, no las fotos
- [ ] Botón de editar lleva al modal de edición de reglas

### Integración con scan
- [ ] Los álbumes se recalculan automáticamente en la próxima visita tras un nuevo scan
- [ ] No hay proceso en background para los álbumes — la query se ejecuta on-demand

---

## API necesaria

### `GET /api/smart-albums`
Lista todos los álbumes del usuario.

### `POST /api/smart-albums`
Crea un nuevo álbum.

**Body:**
```json
{
  "name": "Montañas favoritas",
  "rules": [
    { "field": "tag", "op": "contains", "value": "montaña" },
    { "field": "favorite", "op": "eq", "value": "1" }
  ]
}
```

### `GET /api/smart-albums/[id]`
Devuelve el álbum y ejecuta la query para obtener las fotos actuales.

### `PATCH /api/smart-albums/[id]`
Actualiza nombre y/o reglas.

### `DELETE /api/smart-albums/[id]`
Elimina el álbum (no las fotos).

### `GET /api/smart-albums/preview`
Ejecuta las reglas enviadas en query params y devuelve solo el recuento. Usado en el modal en tiempo real.

---

## Ruta y navegación

- Ruta índice: `/smart-albums`
- Ruta detalle: `/smart-albums/[id]`
- Sección "Álbumes" en el sidebar, por debajo de "Proyectos"
- Icono: `IconSmartAlbum` (carpeta con estrella o filtro)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/smart-albums/page.tsx` | Lista de álbumes |
| `src/app/smart-albums/[id]/page.tsx` | Vista de fotos de un álbum |
| `src/app/smart-albums/SmartAlbumBuilder.tsx` | Modal de creación/edición de reglas con preview |
| `src/app/api/smart-albums/route.ts` | GET lista, POST crear |
| `src/app/api/smart-albums/[id]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/smart-albums/preview/route.ts` | GET recuento en tiempo real |
| `src/lib/smartAlbumQuery.ts` | Traduce reglas JSON → SQL seguro (whitelist de campos) |
| `src/lib/db.ts` | Añadir tabla `smart_albums` |
| `src/components/Sidebar.tsx` | Nueva sección "Álbumes" |
| `src/components/Icons.tsx` | Añadir `IconSmartAlbum` |

---

## Notas técnicas

- La tabla `smart_albums` almacena `name TEXT` y `rules TEXT` (JSON serializado)
- `smartAlbumQuery.ts` valida cada regla contra una whitelist de campos permitidos antes de construir el SQL para prevenir inyección
- El constructor de SQL usa parámetros bind de SQLite (`?`), nunca interpolación de strings
- La query resultante sigue el mismo patrón de la API `/api/photos` — mismos JOINs, mismos índices
- El preview en tiempo real usa debounce de 300 ms en el componente para no lanzar una query por cada keystroke

---

## Fuera de alcance (v1)

- Reglas basadas en rango de fechas exactas (solo año disponible en v1)
- Álbumes con condición AND/OR explícita entre grupos de reglas (en v1 todas las reglas se combinan con AND)
- Ordenación personalizada dentro del álbum
- Exportar un álbum inteligente como Proyecto estático
- Compartir álbumes con otros usuarios
