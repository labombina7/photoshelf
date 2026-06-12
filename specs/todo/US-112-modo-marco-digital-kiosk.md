# Feature: Modo marco digital (kiosk) para TV o tablet

## Historia de usuario

Como usuario con la app corriendo 24/7 en su red doméstica,
quiero un modo marco digital que reproduzca fotos indefinidamente en una TV o tablet vieja,
para dar vida a mi archivo fotográfico sin comprar un Nixplay ni subir fotos a la nube.

---

## Descripción

El slideshow actual (US-051) está pensado para sesiones activas: requiere login, se lanza desde una vista filtrada y termina al cerrar. Un marco digital necesita lo contrario: arrancar solo, reproducir para siempre y sobrevivir reinicios del dispositivo.

El modo kiosk añade una URL dedicada `/frame?token=…` con un token de dispositivo configurable en ajustes. La pantalla reproduce un flujo continuo de fotos según una fuente elegida (favoritos, una temática, un smart album, o «sorpréndeme» — muestreo aleatorio ponderado por año), con reloj opcional y transiciones suaves. Pensada para el navegador de una TV, un Chromecast o una tablet apoyada en una estantería: pantalla completa, sin chrome de la app, wake-lock para que no se apague.

Reutiliza el motor del Slideshow existente (crossfade dual-slot, preload) con una capa de fuente de datos infinita.

---

## Criterios de aceptación

### Token de dispositivo
- [ ] En Ajustes → General se puede generar/revocar un token de marco (uno o varios)
- [ ] `/frame?token=…` funciona sin sesión; token revocado → pantalla de aviso
- [ ] El token solo da acceso a thumbnails (1920 máx.), nunca a originales ni al resto de la app

### Reproducción
- [ ] Fuente seleccionable al crear el token: favoritos / temática / smart album / aleatorio ponderado
- [ ] Reproducción infinita sin repetición hasta agotar el pool (luego rebaraja)
- [ ] Intervalo configurable (10 s–5 min) y transición crossfade reutilizada del Slideshow
- [ ] Overlay opcional: reloj + evento/fecha de la foto (configurable por token)

### Robustez 24/7
- [ ] Wake Lock API para evitar que la pantalla se apague (donde el navegador lo soporte)
- [ ] Si una foto falla al cargar, se salta sin romper el bucle
- [ ] Recuperación automática tras pérdida de red (reintentos con backoff)

---

## API necesaria

- `GET /api/frame/[token]/next?count=20` — lote siguiente de IDs según la fuente del token (sin sesión, validado por token)
- `POST /api/frame/tokens` / `DELETE /api/frame/tokens/[id]` — gestión desde ajustes (con sesión)

---

## Ruta y navegación

- `/frame` — pantalla completa fuera del app-shell, excluida del middleware con validación propia
- Sección «Marco digital» en `/settings/general`

---

## Componentes nuevos o modificados

| Componente | Descripción |
|---|---|
| `src/app/frame/FrameClient.tsx` | Reproductor kiosk (reutiliza lógica de Slideshow) |
| `src/app/settings/general/GeneralClient.tsx` | Gestión de tokens de marco |
| `src/lib/queries/frame.ts` | Tabla `frame_tokens` + muestreo |
| `src/middleware.ts` | Exclusión de `/frame` y `/api/frame/[token]/*` |

---

## Notas técnicas

- Muestreo aleatorio ponderado en SQLite: `ORDER BY RANDOM()` con `LIMIT` por lotes es suficiente para pools <100k fotos; servir IDs en lotes de 20 y pedir el siguiente lote en background.
- El crossfade dual-slot del Slideshow ya evita parpadeos; extraerlo a un componente compartido en lugar de duplicarlo.
- Wake Lock requiere HTTPS o localhost en algunos navegadores — documentar la limitación para TVs.

---

## Fuera de alcance (v1)

- App nativa de TV / protocolo Cast
- Pan & zoom Ken Burns sobre las fotos
- Programación horaria (encendido/apagado del flujo)
