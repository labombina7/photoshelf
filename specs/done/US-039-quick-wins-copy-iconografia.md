# Feature: Quick-wins de copy, iconografía y coherencia visual

> Estado: ✅ Desplegada — PR #76 mergeado el 2026-05-30

## Historia de usuario

Como usuario de photoshelf,
quiero que todos los botones, iconos y textos de la interfaz sean coherentes y semánticamente correctos,
para poder usar la app con confianza sabiendo qué hace cada control sin necesidad de adivinar.

---

## Descripción

La auditoría UX identificó un conjunto de problemas pequeños pero visibles de copy e iconografía que, tomados juntos, transmiten descuido en la cuidada interfaz de photoshelf. Todos son cambios de una o pocas líneas con impacto desproporcionado en la percepción de calidad.

Los problemas agrupados en esta US son:

1. **Botón "+" en DetailPanel**: el botón de confirmar una etiqueta nueva muestra solo el carácter `+`, sin `aria-label` ni texto descriptivo. Un botón sin label no es accesible y es ambiguo.
2. **Icono `ⓘ` unicode en visor mobile**: el FAB de información en `PhotoDetailClient.tsx` usa el carácter unicode `ⓘ`, que renderiza diferente en iOS y Android según la fuente del sistema.
3. **Botón `×` en el mapa**: el botón de cierre del panel del mapa usa el carácter tipográfico `×`, inconsistente con `<IconX>` usado en el resto de la app.
4. **Icono "Sin clasificar" en sidebar**: usa `<IconSearch />` (lupa), lo que es semánticamente incorrecto — la acción es filtrar fotos sin tags, no buscar.
5. **Icono "Catálogos" duplica "Proyectos"**: ambos usan `<IconFolder>`, creando ambigüedad visual entre dos secciones distintas.
6. **Texto "↓ Original"**: poco claro sobre si descarga o abre; no informa del peso del archivo.
7. **Placeholder `(⌘K)` hardcodeado**: solo correcto en macOS; en Windows/Linux el atajo es `Ctrl+K`.
8. **Estado vacío de proyectos no usa `<EmptyState>`**: usa texto plano sin icono ni CTA, a diferencia del resto de secciones.
9. **Spinner inline en botón "Reescanear"**: el botón se desactiva cuando hay un escaneo en curso pero no muestra ningún indicador visual de actividad.

---

## Criterios de aceptación

### Botón "+" en DetailPanel
- [ ] El botón de confirmar etiqueta pasa de `>+<` a `>Añadir<` con `aria-label="Añadir etiqueta"`
- [ ] Visualmente usa el componente `Button` existente con variante `small` o el estilo `.btn-small` mejorado

### Icono unicode en visor mobile
- [ ] El carácter `ⓘ` en `PhotoDetailClient.tsx` se reemplaza por el SVG inline del icono de información (circle + line)
- [ ] El SVG usa las mismas dimensiones y estilos que el resto de iconos del mismo componente

### Botón `×` en el mapa
- [ ] El carácter `×` en `MapClient.tsx` se reemplaza por `<IconX size={14} />`
- [ ] El botón tiene `aria-label="Cerrar panel"`

### Icono "Sin clasificar" en sidebar
- [ ] Se crea `<IconTagEmpty>` (tag con signo de interrogación o tachado) o se adapta `<IconTag>` con estilo diferenciado
- [ ] El ítem "Sin clasificar" en el sidebar usa el nuevo icono en lugar de `<IconSearch />`

### Icono "Catálogos" en sidebar
- [ ] La entrada de "Catálogos" en el sidebar usa `<IconViewGrid>` u otro icono distinto a `<IconFolder>`
- [ ] Los proyectos individuales mantienen `<IconFolder>` para distinguir ambas secciones

### Texto "Descargar original"
- [ ] El texto `↓ Original` en `PhotoDetailClient.tsx` cambia a "Descargar original"
- [ ] Si los metadatos incluyen `size_bytes`, se muestra entre paréntesis: "Descargar original (3,2 MB)"

### Placeholder del buscador
- [ ] El placeholder detecta el SO del usuario y muestra `(⌘K)` en macOS o `(Ctrl+K)` en Windows/Linux
- [ ] Alternativa aceptable: simplificar a `(/ para buscar)` con una tecla neutra si la detección añade complejidad

### Estado vacío de proyectos
- [ ] `ProjectsClient.tsx` reemplaza el texto plano por `<EmptyState icon={...} title="Aún no hay proyectos" subtitle="Genera tu primer portfolio con IA a partir de cualquier conjunto de fotos." action={{ label: 'Crear primer proyecto', onClick: () => setShowNew(true) }} />`
- [ ] El patrón sigue el mismo estilo que `TagsClient.tsx`

### Spinner en "Reescanear biblioteca"
- [ ] Cuando `running === true`, el botón del sidebar muestra `<span className="spinner dark" />` + "Escaneando…"
- [ ] El patrón es idéntico al botón de login (`src/app/login/page.tsx`)

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/components/DetailPanel.tsx` | Botón "+" → "Añadir" con `aria-label` |
| `src/app/library/[photoId]/PhotoDetailClient.tsx` | `ⓘ` → SVG, "↓ Original" → "Descargar original" |
| `src/app/map/MapClient.tsx` | `×` → `<IconX>` con `aria-label` |
| `src/components/Sidebar.tsx` | Icono "Sin clasificar" y "Catálogos" corregidos; spinner en "Reescanear" |
| `src/components/Icons.tsx` | Nuevo `<IconTagEmpty>` (si no existe un icono adecuado) |
| `src/components/AppHeader.tsx` | Placeholder con detección de SO para `⌘K` / `Ctrl+K` |
| `src/app/projects/ProjectsClient.tsx` | Estado vacío con `<EmptyState>` y CTA |

---

## Notas técnicas

- La detección del SO para el atajo de teclado debe hacerse con `navigator.platform` o `navigator.userAgent` en un `useEffect` o `useMemo` (solo se ejecuta en cliente)
- El spinner inline del botón "Reescanear" ya existe en `globals.css` como `.spinner.dark` — copiar el patrón del login
- El tamaño de archivo (`size_bytes`) ya está en el esquema de `photos` — `PhotoDetailClient.tsx` ya recibe los metadatos de foto completos

---

## Fuera de alcance (v1)

- Rediseño completo del sistema de iconos
- Internacionalización (i18n) de los textos de la interfaz
- Tooltip animado en el FAB de información de tablet
