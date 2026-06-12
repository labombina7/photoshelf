# Feature: Hardening del despliegue — usuario no-root, dependencias y compose portable

## Historia de usuario

Como operador que despliega photoshelf en su NAS,
quiero que el contenedor corra sin privilegios de root, sin vulnerabilidades conocidas y con una configuración portable,
para reducir el riesgo de seguridad y poder reutilizar el compose en cualquier entorno.

---

## Descripción

Tres hallazgos de despliegue del tech debt audit del 2026-06-12 (complementa a US-089, que cubre el healthcheck):

1. **El contenedor corre como root**: el `Dockerfile` no tiene directiva `USER`, pero `.env.example:19` afirma «El proceso del contenedor corre como UID 1000» — documentación y realidad contradictorias, y un proceso root escribiendo en volúmenes del NAS.
2. **Vulnerabilidad moderada en dependencias**: `npm audit --omit=dev` reporta postcss <8.5.10 (XSS, GHSA-qx2v-qp2m-jg93) transitiva vía `next@15.5.18`. Además `@types/archiver` está en `dependencies` de producción.
3. **docker-compose.yml con datos personales**: `PHOTOS_PATH: /volume1/homes/javi/Photos`, IP de Ollama `192.168.1.135` y `DATA_PATH` personal hardcodeados en un repo cuya imagen es pública en ghcr.io.

---

## Criterios de aceptación

### Usuario no-root
- [ ] `USER node` en el stage runner del Dockerfile (UID 1000, ya existe en la imagen base)
- [ ] La app arranca y escribe correctamente en `/data` (BD, caché, backups) como UID 1000
- [ ] README/`.env.example` documentan el requisito de permisos del volumen (ya parcialmente documentado)

### Dependencias
- [ ] `npm update next` a la última 15.x; `npm audit --omit=dev` sin vulnerabilidades moderadas o superiores
- [ ] `@types/archiver` movido a `devDependencies`
- [ ] El `require('archiver') as any` de `src/app/share/[token]/route.ts:76` pasa a import tipado

### Compose portable
- [ ] `PHOTOS_PATH`, `OLLAMA_URL` y `DATA_PATH` parametrizados con `${VAR}` y defaults genéricos (`/photos`, `http://host.docker.internal:11434`)
- [ ] Los valores personales viven solo en el `.env` local (no comiteado)
- [ ] `.env.example` actualizado con las nuevas variables

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `Dockerfile` | `USER node` + verificación de permisos |
| `docker-compose.yml` | Variables parametrizadas |
| `.env.example` | Documentación coherente |
| `package.json` | next actualizado, types a devDeps |
| `src/app/share/[token]/route.ts` | Import tipado de archiver |

---

## Notas técnicas

- Tras añadir `USER node`, probar el flujo completo de backup (`VACUUM INTO` en `/data/backups`) — es la escritura más sensible a permisos.
- El montaje `/volume1:/volume1:ro` completo es cómodo para multi-catálogo pero expone todo el NAS en lectura; valorar montar solo los directorios de fotos (decisión del operador, documentarla).

---

## Fuera de alcance (v1)

- Healthcheck (cubierto por US-089, actualizada con los hallazgos del 06-12)
- Imagen distroless o multi-arch

> Estado: ✅ Desplegada
