# Feature: Variables CSS fantasma y paleta de estados unificada

## Historia de usuario

Como usuario de photoshelf,
quiero que todos los elementos de la interfaz rendericen con los colores que el diseño pretende,
para que controles como el selector de nivel del timeline o el diálogo de compartir no aparezcan rotos o ilegibles.

---

## Descripción

El UX audit del 2026-06-12 detectó tres variables CSS que se usan pero **nunca se definen** en `:root`: `--text-primary` (en `globals.css:1186,1236`, `JobsClient.tsx:134`, `ShareDialog.tsx:57`), `--text-muted` (`ShareDialog.tsx:40`, `LineChart.tsx:86,97`) y `--surface-raised` (`globals.css:2690`). El efecto es visible hoy: el botón de nivel activo del timeline (`.timeline-level-btn.active`) tiene `background: var(--text-primary)` que el navegador descarta por inválido, así que el botón activo apenas se distingue del resto.

Es una segunda pasada de US-037 (que corrigió otras variables: FAB, skeleton, marcadores del mapa) — estas tres instancias quedaron fuera o se introdujeron después.

Además, la paleta de estados está fragmentada: cinco colores ad-hoc para peligro/aviso/info (`#dc2626`, `#b91c1c`, `#c0392b`, `#e67e22`, `#3b82f6` — este último ni siquiera es el azul de marca `--accent: #3b62d4`). Esta US define tokens semánticos y migra los hardcodes.

---

## Criterios de aceptación

### Variables fantasma
- [ ] `:root` define `--text-primary`, `--text-muted` y `--surface-raised` (como alias de las variables existentes o valores propios)
- [ ] El botón de nivel activo del timeline se distingue visualmente (fondo oscuro, texto claro)
- [ ] ShareDialog, JobsClient y LineChart renderizan con los grises intencionados
- [ ] No queda ningún `var(--…)` en `src/` que no esté definido en `globals.css` (verificable con grep)

### Paleta de estados
- [ ] `:root` define `--danger`, `--warning`, `--info`
- [ ] Los hardcodes `#dc2626`, `#b91c1c`, `#c0392b`, `#e67e22`, `#3b82f6` migran a los tokens
- [ ] El badge de jobs activos usa `--accent` o `--info`, no un azul ajeno a la marca

### Consistencia ShareDialog
- [ ] ShareDialog usa `px` y clases de `globals.css` en lugar de `rem` + estilos inline

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/globals.css` | Definir variables en `:root`, migrar selectores |
| `src/components/ShareDialog.tsx` | Variables correctas + normalizar unidades |
| `src/app/jobs/JobsClient.tsx` | `--text-primary` → token válido |
| `src/app/insights/components/LineChart.tsx` | `--text-muted` → token válido |
| `src/components/Sidebar.tsx` | Badges de jobs/integridad a tokens semánticos |
| `src/components/DetailPanel.tsx` | Rojos de error a `--danger` |

---

## Notas técnicas

- Alias mínimo viable: `--text-primary: var(--text); --text-muted: var(--text-tertiary); --surface-raised: var(--bg-secondary);` — 3 líneas que arreglan todos los usos actuales.
- Añadir un check de lint o script (`grep -oE 'var\(--[a-z-]+\)' src | sort -u` contra las definidas) en el CI para evitar regresiones.

---

## Fuera de alcance (v1)

- Modo oscuro / theming dinámico
- Rediseño de la paleta de marca

> Estado: ✅ Desplegada
