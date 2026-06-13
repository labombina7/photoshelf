# Feature: Búsqueda semántica degrada a búsqueda por texto/tags cuando la IA está desactivada

## Historia de usuario

Como usuario de photoshelf sin IA configurada,
quiero que la búsqueda siga funcionando con mis tags, eventos y metadatos,
para que la app sea completamente usable aunque no tenga Ollama ni un proveedor cloud.

---

## Descripción

Hoy si Ollama no responde, la búsqueda semántica falla con error. Esta US garantiza que cuando la IA está desactivada (o no disponible), la búsqueda cae automáticamente a una búsqueda por texto completo sobre tags, eventos, nombre de carpeta y metadatos EXIF — sin mostrar error al usuario, sino una búsqueda funcionando con menor capacidad.

---

## Criterios de aceptación

### Comportamiento degradado
- [ ] Con IA desactivada, el clasificador de intención no activa el path semántico
- [ ] Las queries que habrían ido a Ollama se redirigen a búsqueda fulltext (tags + eventos + carpeta)
- [ ] El badge "✦ IA" en la barra de búsqueda no aparece cuando la IA está desactivada
- [ ] No se muestra ningún error al usuario — la búsqueda funciona, simplemente sin comprensión semántica

### Con IA activada (sin regresión)
- [ ] El comportamiento actual de búsqueda semántica no cambia
- [ ] El badge IA sigue apareciendo correctamente

### Comunicación al usuario
- [ ] Si el usuario escribe una query claramente semántica (ej. "fotos en la playa") y la IA está off, los resultados incluyen un hint sutil: "Búsqueda por texto — activa la IA en ajustes para búsqueda semántica"

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/lib/search/classifier.ts` | No activar intent semántico si `enabled = false` |
| `src/app/api/search/route.ts` | Devolver hint de degradación cuando aplica |
| `src/app/search/SearchClient.tsx` | Mostrar hint de modo degradado |

---

## Dependencias

- **US-123** — `getAIProvider()` integrado; `enabled` accesible en la capa de búsqueda
- Parte de **EPIC-007**

## Fuera de alcance

- Búsqueda por embeddings/vectores sin IA (requeriría un motor de búsqueda diferente)
- Persistencia del hint de degradación (se muestra live, no se guarda)
