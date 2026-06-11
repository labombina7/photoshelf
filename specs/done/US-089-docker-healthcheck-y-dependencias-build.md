# Feature: Docker healthcheck y limpieza de dependencias de build

## Historia de usuario

Como operador que ejecuta photoshelf en un NAS Synology,
quiero que el contenedor Docker reporte su estado de salud al orquestador y no incluya dependencias innecesarias en la imagen de producción,
para que Container Manager pueda reiniciar el contenedor si se cuelga y la imagen sea lo más ligera posible.

---

## Descripción

El audit de deuda técnica (2026-06-06) identificó dos problemas en la configuración de Docker:

**1. Sin `healthcheck` en `docker-compose.yml`**: el orquestador solo sabe si el proceso `node server.js` existe, pero no si la aplicación está respondiendo correctamente. Si Next.js arranca pero queda en estado zombie (por ejemplo, si la BD está bloqueada), Docker no lo detecta y no reinicia el contenedor. El endpoint `/api/health` ya existe y puede usarse como health check.

**2. `node-addon-api` en `dependencies`**: este paquete es un build tool necesario para compilar el addon nativo de `better-sqlite3`, pero solo se usa durante el `npm ci` de la fase de build. Al estar en `dependencies` en lugar de `devDependencies`, el Dockerfile lo copia a la imagen final añadiendo ~1MB innecesario. En el Dockerfile actual esto no tiene impacto real porque se usa un build multistage, pero es una mala práctica que puede confundir.

---

## Criterios de aceptación

### Healthcheck en docker-compose.yml
- [ ] `docker-compose.yml` incluye un bloque `healthcheck` que llama a `curl -f http://localhost:3000/api/health`
- [ ] El healthcheck tiene `interval: 30s`, `timeout: 5s`, `retries: 3`, `start_period: 15s`
- [ ] `docker inspect <container>` muestra el estado como `healthy` cuando la app está funcionando
- [ ] Si la app no responde, el contenedor pasa a estado `unhealthy` y Docker lo reinicia (gracias a `restart: unless-stopped` ya configurado)

### Dependencias de build
- [ ] `node-addon-api` está en `devDependencies` en `package.json`
- [ ] El build de Docker (`docker build`) sigue funcionando sin errores (el `npm ci` en el stage builder instala también devDeps)
- [ ] La imagen de producción resultante tiene el mismo tamaño o menor

### Sin regresiones
- [ ] La app arranca correctamente con `docker-compose up`
- [ ] El endpoint `/api/health` responde con `200` cuando la app está sana

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `docker-compose.yml` | Añadir bloque `healthcheck` al servicio `app` |
| `package.json` | Mover `node-addon-api` de `dependencies` a `devDependencies` |

---

## Notas técnicas

- `curl` debe estar disponible en la imagen de producción (`node:20-slim`). Si no está, usar `wget -q -O - http://localhost:3000/api/health || exit 1` como alternativa, o añadir `curl` al `apt-get install` de la imagen runner
- Verificar que `node:20-slim` incluye `curl` por defecto antes de asumir que está disponible
- El `restart: unless-stopped` ya está en el `docker-compose.yml` y garantiza el reinicio automático

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 15s
```

---

## Fuera de alcance (v1)

- Health checks granulares (estado de BD, estado de Ollama) — el endpoint `/api/health` ya los cubre internamente
- Notificaciones externas cuando el contenedor queda unhealthy
- Optimización adicional del tamaño de imagen (multi-stage más agresivo)

> Estado: ✅ Desplegada
