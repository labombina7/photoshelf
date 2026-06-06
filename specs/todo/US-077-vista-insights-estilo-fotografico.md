# US-077: Vista de insights — estilo fotográfico en el sidebar

> **Épica padre:** [EPIC-004 — Análisis de estilo fotográfico](EPIC-004-analisis-estilo-fotografico.md)
> **Depende de:** US-074, US-075, US-076

## Historia de usuario

Como fotógrafo que usa photoshelf,
quiero una vista en el sidebar donde pueda leer mis insights de estilo fotográfico,
para conocerme mejor como fotógrafo, entender cómo he evolucionado y recibir orientación concreta de mejora.

---

## Descripción

Esta US construye la única parte visible para el usuario de toda la épica: la vista de insights en el sidebar. El contenido viene de los perfiles sintetizados por US-076; esta US solo presenta ese contenido de forma clara y útil.

La vista tiene dos bloques bien diferenciados en propósito y ritmo de actualización:

**Bloque 1 — Tu historia fotográfica**
Relato de largo plazo. Muestra los perfiles anuales generados desde el bootstrap. Narra quién eres como fotógrafo a lo largo del tiempo: qué géneros has practicado por épocas, cómo ha evolucionado tu mirada, qué equipo te ha acompañado. Se actualiza una vez al año.

**Bloque 2 — Tu evolución reciente**
Vista viva de los últimos 24 meses. Muestra los perfiles mensuales en orden cronológico inverso, con énfasis en los más recientes. Incluye: tendencias activas, equipo usado en los últimos meses, dirección del estilo y consejos de mejora específicos. Se actualiza cada mes.

---

## Criterios de aceptación

### Entrada en el sidebar

- [ ] Se añade una nueva entrada al sidebar con icono y etiqueta "Tu estilo" (o similar — revisar con el diseño actual del sidebar)
- [ ] La entrada lleva a la ruta `/insights` (nueva página dentro del App Router)
- [ ] Si el bootstrap no ha terminado, la entrada está visible pero muestra un estado de carga con mensaje explicativo

### Estado de carga / bootstrap en curso

- [ ] Si `getBootstrapProgress()` devuelve `percent < 100`, se muestra un estado intermedio:
  - Barra de progreso o indicador visual
  - Mensaje: "Estamos analizando tu catálogo. Los primeros insights estarán listos en breve."
  - Si ya hay algunos perfiles disponibles (bootstrap parcialmente completado), se muestran los que hay con una nota de que el análisis continúa

### Bloque 1 — Tu historia fotográfica

- [ ] Se muestran los perfiles anuales en orden cronológico inverso (año más reciente primero)
- [ ] Cada año muestra: el año como cabecera, el texto narrativo generado por Ollama
- [ ] Si solo hay perfiles de 1 año, se muestra ese año sin comparativas
- [ ] Si no hay perfiles anuales aún (bootstrap reciente), el bloque muestra un placeholder: "Tu historia fotográfica estará disponible cuando completemos el análisis de tu catálogo histórico"

### Bloque 2 — Tu evolución reciente

- [ ] Se muestran los últimos 24 meses con perfiles disponibles, en orden cronológico inverso
- [ ] El mes más reciente se expande por defecto; el resto se pueden expandir/colapsar
- [ ] Cada mes muestra:
  - Cabecera: mes y año
  - Texto narrativo completo de Ollama
  - Sección "Destacados": los 2-3 highlights del mes (campo `highlights` del perfil)
  - Sección "Tendencia": el campo `trend` del perfil — una frase sobre hacia dónde va el estilo
- [ ] Si el mes en curso no tiene perfil todavía (el ciclo mensual aún no ha cerrado), se muestra "Mes en curso — el perfil estará listo el próximo mes"

### Datos de equipo y EXIF (visual)

- [ ] En cada bloque mensual se muestra un resumen visual compacto de las señales del periodo: cámara + objetivo más usados, focal más frecuente, ISO medio — viene del campo `period_summary` del perfil
- [ ] El formato es una fila de chips/badges, no una tabla completa

### Actualización

- [ ] La vista se refresca automáticamente cuando hay un perfil nuevo disponible (polling ligero o revalidación de Next.js — no WebSocket)

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/app/insights/page.tsx` | Nueva página — vista principal de insights |
| `src/app/insights/components/` | Componentes: `HistoryBlock`, `RecentEvolutionBlock`, `MonthProfile`, `BootstrapProgress` |
| `src/app/api/insights/route.ts` | Nuevo endpoint — devuelve perfiles y progreso del bootstrap |
| Sidebar (componente existente) | Añadir entrada "Tu estilo" con su icono |

---

## Notas técnicas

- La página es un Server Component que hace fetch de los perfiles al renderizar — no necesita estado cliente salvo para el acordeón de meses
- El endpoint `/api/insights` devuelve: `{ bootstrapProgress, annualProfiles: StyleProfile[], monthlyProfiles: StyleProfile[] }`
- El diseño debe ser coherente con el resto de la app (variables CSS de `globals.css`, sin Tailwind)
- En móvil / pantalla estrecha, los dos bloques se apilan verticalmente con el Bloque 2 primero (más relevante para el uso cotidiano)

---

## Fuera de alcance

- Recomendaciones de fotógrafos o recursos externos (extensión futura)
- Edición o corrección manual de los insights por parte del usuario
- Compartir los insights como imagen o PDF
- Notificaciones push cuando el perfil mensual está listo
