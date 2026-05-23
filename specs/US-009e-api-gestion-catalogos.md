# Feature: US-009e — API REST de gestión de catálogos

## Historia de usuario

Como usuario de photoshelf,
quiero poder crear, renombrar y eliminar catálogos a través de la API,
para gestionar mi biblioteca de catálogos de forma programática y desde la UI.

---

## Descripción

Crea los endpoints CRUD para gestionar catálogos. Estos endpoints son los que usan US-009f
(selector de catálogo) y US-009g (página de gestión).

---

## Criterios de aceptación

### Endpoints
- [ ] `GET /api/catalogs` — lista todos los catálogos con `id`, `name`, `path`, `photoCount`
- [ ] `POST /api/catalogs` — crea catálogo; body: `{ name, path }`; valida que `path` existe en disco
- [ ] `PATCH /api/catalogs/[id]` — renombra; body: `{ name }`
- [ ] `DELETE /api/catalogs/[id]` — elimina el catálogo (sin borrar las fotos del disco)

### Reglas de negocio
- [ ] No se puede eliminar el catálogo con `id = 1` ("Principal") — devuelve 400
- [ ] No se puede eliminar el catálogo activo de la sesión del usuario — devuelve 400
- [ ] Al eliminar un catálogo, sus fotos en la BD se eliminan en cascada (o se reasignan al catálogo 1)
- [ ] Dos catálogos no pueden tener el mismo `path`

### Validación
- [ ] El `path` de un nuevo catálogo debe existir en el sistema de archivos del servidor
- [ ] El `path` no puede ser igual ni contener otro `path` de catálogo existente (evitar solapamiento)
- [ ] El `name` es obligatorio y tiene máximo 100 caracteres

---

## API necesaria

| Endpoint | Método | Request | Response |
|----------|--------|---------|----------|
| `/api/catalogs` | GET | — | `{ catalogs: Catalog[] }` |
| `/api/catalogs` | POST | `{ name, path }` | `{ catalog: Catalog }` |
| `/api/catalogs/[id]` | PATCH | `{ name }` | `{ catalog: Catalog }` |
| `/api/catalogs/[id]` | DELETE | — | `{ ok: true }` |

```typescript
interface Catalog {
  id: number;
  name: string;
  path: string;
  photoCount: number;
  createdAt: number;
}
```

---

## Componentes nuevos

| Archivo | Descripción |
|---|---|
| `src/app/api/catalogs/route.ts` | GET list + POST create |
| `src/app/api/catalogs/[id]/route.ts` | PATCH rename + DELETE remove |

---

## Fuera de alcance

- Mover fotos físicamente de un directorio a otro al cambiar el path
- Estadísticas avanzadas por catálogo
