# Feature: Timeline View

> **Estado: ✅ Desplegada** — merged en main el 2026-05-22

## Historia de usuario

Como fotógrafo que gestiona una biblioteca grande,
quiero explorar mis fotos en un grid cronológico con zoom temporal
para navegar visualmente por mis recuerdos sin tener que saber el nombre de la carpeta.

---

## Descripción

Una vista nueva accesible desde el sidebar llamada **"Línea de tiempo"**.
Muestra todas las fotos ordenadas por fecha en un grid continuo y scrolleable.
El nivel de zoom controla la granularidad temporal:

| Nivel | Agrupa por | Cabecera flotante |
|-------|-----------|-------------------|
| Año   | Año       | `2024`            |
| Mes   | Mes       | `Mayo 2024`       |
| Día   | Día       | `14 de mayo 2024` |

---

## Criterios de aceptación

### Navegación y scroll
- [ ] El grid muestra fotos ordenadas de más reciente a más antigua (desc)
- [ ] Al hacer scroll, una cabecera sticky muestra el período actual visible
  (el período del primer grupo que aparece en pantalla)
- [ ] La cabecera se actualiza suavemente conforme se avanza en el scroll
- [ ] Scroll infinito: carga el siguiente bloque de fotos al acercarse al final

### Zoom temporal
- [ ] Tres niveles: **Año**, **Mes**, **Día** (por defecto: Mes)
- [ ] Controles de zoom visibles en el topbar: botones `−` / `+` o un selector
- [ ] En desktop, la rueda del ratón con `Ctrl` held cambia el nivel de zoom
- [ ] En mobile, un doble tap alterna entre Mes y Día
- [ ] Al cambiar de nivel, la vista hace scroll hasta mantener el período visible

### Grid
- [ ] Desktop: 5 columnas. Mobile: 3 columnas
- [ ] Miniaturas cuadradas (object-fit: cover), tamaño 200px
- [ ] Al pulsar una foto se abre el detalle (`/library/[id]`)
- [ ] `loading="lazy"` + `decoding="async"` en todas las imágenes

### Cabecera de período
- [ ] Posición: sticky top dentro del grid, no oculta el topbar
- [ ] Muestra el label del período (año / "Enero 2024" / "3 de enero 2024")
- [ ] En Nivel Año: muestra también el número de fotos de ese año
- [ ] Tipografía ligera, no invasiva — el protagonismo es la foto

### Fotos sin fecha
- [ ] Fotos con `taken_at = NULL` se agrupan al final bajo "Sin fecha"
- [ ] Solo se muestran si existen

### Performance
- [ ] La primera pantalla carga en < 2 s en móvil (máx 60 fotos iniciales)
- [ ] Cada bloque de paginación: 60 fotos
- [ ] Las miniaturas ya están en caché WebP en disco (reutiliza `/api/photos/[id]/thumbnail`)

---

## API necesaria

### `GET /api/timeline`

Devuelve fotos agrupadas por período según el nivel de zoom, paginadas.

**Query params:**
| Param    | Tipo                     | Default | Descripción                        |
|----------|--------------------------|---------|------------------------------------|
| `level`  | `year \| month \| day`   | `month` | Granularidad temporal              |
| `cursor` | `string` (ISO date)      | —       | Fecha a partir de la que paginar   |
| `limit`  | `number`                 | `60`    | Fotos por página                   |

**Respuesta:**
```json
{
  "groups": [
    {
      "label": "Mayo 2024",
      "period": "2024-05",
      "count": 34,
      "photos": [
        { "id": 1, "filename": "...", "taken_at": "2024-05-14T..." }
      ]
    }
  ],
  "nextCursor": "2024-04-30T23:59:59",
  "hasMore": true
}
```

---

## Ruta y navegación

- Ruta: `/timeline`
- Enlace en sidebar bajo **Biblioteca**, entre "Todas las fotos" y "Favoritos"
- Icono: `IconTimeline` (reloj o cuadrícula con línea temporal)
- Activo cuando `pathname === '/timeline'`

---

## Componentes nuevos

| Componente | Descripción |
|---|---|
| `src/app/timeline/page.tsx` | Server component — carga datos iniciales del primer bloque |
| `src/app/timeline/TimelineClient.tsx` | Client component — grid, scroll, zoom, cabecera sticky |
| `src/app/api/timeline/route.ts` | API endpoint con paginación por cursor |
| `src/components/Icons.tsx` | Añadir `IconTimeline` |

---

## Notas técnicas

- La cabecera sticky usa `IntersectionObserver` sobre el primer elemento de cada grupo para detectar qué período está en pantalla (mismo patrón que usan Apple Photos / Google Photos)
- El cursor de paginación es una fecha ISO para evitar problemas con `OFFSET` grande en SQLite
- El nivel de zoom se persiste en `sessionStorage` para mantenerlo al volver de una foto
- La query SQL ordena por `taken_at DESC NULLS LAST`, con fallback a `created_at` si `taken_at` es NULL

---

## Fuera de alcance (v1)

- Mapa geográfico de fotos
- Filtrado por año/mes dentro de la timeline (eso ya lo hace la biblioteca)
- Animación de transición entre niveles de zoom
