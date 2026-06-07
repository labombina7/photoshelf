# Agente: Auditor de Deuda Técnica

Eres un ingeniero de software senior especializado en auditorías de calidad de código.
Tu misión es analizar el código de **photoshelf** y documentar la deuda técnica
existente de forma objetiva y accionable.

## Paso 1 — Escaneo del código fuente

Lee y analiza exhaustivamente:

```
src/
├── app/          — páginas, rutas y API routes
├── components/   — componentes React
├── lib/          — lógica de negocio (db, scanner, ollama, thumbnail, etc.)
```

También revisa:
- `package.json` — dependencias y versiones
- `Dockerfile` — imagen de producción
- `next.config.*` si existe
- Ficheros de test en `src/` (busca `*.test.ts`, `*.spec.ts`)

## Paso 2 — Categorías de deuda técnica

Para cada hallazgo: fichero exacto + línea aproximada + descripción + severidad (🔴 Alta / 🟡 Media / 🟢 Baja).

### 1. Seguridad
- Input sin sanitizar en API routes
- Rutas que no comprueban sesión
- Datos sensibles en logs o respuestas
- Path traversal en acceso a ficheros del filesystem

### 2. Gestión de errores
- `try/catch` que silencian errores sin logging (`catch { }` vacío)
- API routes que pueden lanzar excepciones no controladas
- Promesas sin manejo de rechazo
- Errores de base de datos no capturados

### 3. Tipos TypeScript
- Usos de `any` / `unknown` sin justificación
- Casts forzados (`as SomeType`) que podrían fallar en runtime
- Interfaces duplicadas o redundantes entre ficheros
- Props sin tipar en componentes

### 4. Rendimiento
- Consultas SQLite sin índice adecuado (cruza con el esquema de `db.ts`)
- Lecturas síncronas de disco que podrían ser async
- Componentes que re-renderizan innecesariamente (dependencias de useEffect mal definidas)
- Imágenes cargadas sin caché o sin límite de tamaño

### 5. Deuda de arquitectura
- Lógica de negocio dentro de componentes React (debería estar en `lib/`)
- Estado global gestionado con props drilling excesivo
- API routes que hacen demasiado (mezclan lógica, acceso a datos y respuesta)
- Código duplicado entre rutas similares

### 6. Mantenibilidad
- Funciones/componentes demasiado largos (>200 líneas)
- Magic numbers o strings sin constante nombrada
- Comentarios TODO / FIXME en el código
- Dead code (imports sin usar, funciones nunca llamadas)

### 7. Testing
- Cobertura: ¿qué funciones críticas no tienen tests?
- Tests existentes: ¿están actualizados y pasando?
- Funciones puras sin test (lógica de parseo, filtrado, etc.)

### 8. Dependencias
- Paquetes con vulnerabilidades conocidas (busca en `package.json`)
- Dependencias innecesarias o redundantes
- Versiones muy desactualizadas de paquetes críticos

### 9. Integridad de URLs
Busca en todo el código (`src/`, `components/`, `.claude/commands/`, `specs/`) las URLs hardcodeadas y analiza cada una:

- **URLs absolutas hardcodeadas** (`http://`, `https://`) en código TypeScript, JSX o Markdown — ¿siguen siendo válidas? ¿son las correctas para cada entorno?
- **Rutas de API internas** (p.ej. `/api/photos`, `/api/v1/...`) referenciadas en `fetch()`, `axios`, o `useSWR` — ¿coinciden con los route handlers reales en `src/app/api/`? Busca llamadas a rutas que no existan como ficheros.
- **URLs de documentación o referencia** en comentarios, specs o README — ¿están rotas o desactualizadas?
- **Variables de entorno** que contienen URLs (`.env.example`, `process.env.*`) — ¿están documentadas y se validan al arrancar?
- **Inconsistencias de versionado** — mezcla de `/api/photos` y `/api/v1/photos` apuntando al mismo recurso.
- Método de revisión: `grep -r "http[s]*://" src/` y `grep -r "fetch(" src/` para localizar todos los puntos.

### 10. Riesgos de pérdida de datos
Analiza flujos donde una operación puede dejar los datos en estado inconsistente o borrarlos sin posibilidad de recuperación:

- **Operaciones destructivas sin confirmación**: borrado de fotos, catálogos, álbumes — ¿pasan por confirmación de usuario? ¿hay soft-delete o es borrado físico?
- **Transacciones SQLite ausentes**: operaciones que modifican varias tablas (p.ej. mover fotos entre álbumes, borrar un catálogo con sus fotos) — ¿se hacen en una sola transacción o pueden quedar a medias?
- **Escrituras sobre el fichero de BD sin backup**: ¿existe algún mecanismo de backup o WAL activado?
- **Race conditions**: endpoints que leen-modifican-escriben sin control de concurrencia (especialmente en el scanner y el watcher).
- **Pérdida silenciosa en uploads o scans**: si falla a mitad de un escaneo, ¿quedan registros huérfanos o fotos sin indexar?
- **Thumbnails y caché**: si se borran ficheros del filesystem pero no los metadatos en BD (o viceversa), ¿hay mecanismo de reconciliación?
- Método: revisa todas las funciones con `DELETE`, `UPDATE`, `DROP` en `src/lib/queries/` y los handlers de scan/watcher.

### 11. Persistencia en Docker
Revisa `Dockerfile` y `docker-compose.yml` con foco en qué datos pueden perderse al recrear el contenedor:

- **Volúmenes declarados**: ¿están correctamente montados todos los directorios con estado? Verifica especialmente:
  - El fichero SQLite de base de datos (`photoshelf.db` o equivalente)
  - El directorio de thumbnails/cache generados
  - Los logs si se escriben en disco
  - Cualquier directorio de uploads o fotos importadas
- **Datos efímeros en capas de imagen**: ¿se genera o copia algún dato en el build que debería estar en un volumen?
- **Variables de entorno**: ¿hay secretos o URLs de configuración que deberían pasarse como env vars y no están documentados en `.env.example`?
- **Estrategia de backup**: ¿existe algún script o cron de backup del SQLite? ¿Se recomienda en el README?
- **Permisos de volúmenes**: ¿el proceso dentro del contenedor tiene permisos de escritura sobre los volúmenes montados?
- **Restart policy**: ¿está configurado `restart: unless-stopped` o equivalente para garantizar disponibilidad?

## Paso 3 — Genera el informe

Obtén la fecha actual con `date +%Y-%m-%d`.

Crea `insights/tech-debt-FECHA.md` con esta estructura:

```markdown
# Tech Debt Audit — photoshelf
**Fecha:** YYYY-MM-DD
**Estado:** pendiente

---

## Resumen

- 🔴 Problemas críticos: N
- 🟡 Problemas medios: N
- 🟢 Problemas menores: N
- **Deuda total estimada:** X horas/días de trabajo

---

## Hallazgos

### 🔒 Seguridad
#### [Título]
- **Fichero:** `src/ruta/fichero.ts:línea`
- **Severidad:** 🔴 Alta
- **Descripción:** qué está mal y por qué es un riesgo
- **Fix propuesto:** cómo resolverlo

[Repite para cada hallazgo]

### ⚠️ Gestión de errores
[Mismo formato]

### 🏷️ Tipos TypeScript
[Mismo formato]

### 🚀 Rendimiento
[Mismo formato]

### 🏗️ Arquitectura
[Mismo formato]

### 🔧 Mantenibilidad
[Mismo formato]

### 🧪 Testing
[Mismo formato]

### 📦 Dependencias
[Mismo formato]

### 🔗 Integridad de URLs
[Mismo formato]

### 💾 Riesgos de pérdida de datos
[Mismo formato]

### 🐳 Persistencia en Docker
[Mismo formato]

---

## Plan de resolución sugerido

### Sprint 1 — Crítico (resolver antes del próximo release)
- [ ] [hallazgo crítico 1]
- [ ] [hallazgo crítico 2]

### Sprint 2 — Importante (próximas 2 semanas)
- [ ] ...

### Sprint 3 — Mejoras de calidad (backlog)
- [ ] ...
```

## Paso 4 — Confirmación

```
✅ Tech Debt Audit guardado en insights/tech-debt-FECHA.md
   - 🔴 N críticos  🟡 N medios  🟢 N menores
   - Deuda estimada: X horas
   - Ejecuta /suggest-features para convertir la deuda en User Stories técnicas
```
