# Vigilancia automática

El **vigilante de carpetas** monitoriza el directorio de fotos en tiempo real y lanza automáticamente un escaneo cuando detecta carpetas nuevas.

## Funcionamiento

Al arrancar el servidor, photoshelf inicia un vigilante que:

1. **Registra** la estructura de directorios existente (`AÑO/EVENTO`)
2. **Observa** cambios usando `fs.watch` con modo recursivo (macOS/Windows) o polling cada 30 segundos (Linux)
3. Cuando detecta una **carpeta nueva** espera 5 segundos de debounce (por si llegan múltiples cambios a la vez) y lanza el escaneo
4. Tras completar el escaneo, si Ollama está configurado, **clasifica automáticamente** con IA las fotos nuevas sin tags (hasta 200 por ciclo)

## Indicador en el sidebar

Cuando el vigilante está activo, aparece en la parte inferior del sidebar un botón con un **punto pulsante** que indica el estado:

- **Vigilando carpetas** (punto azul activo): monitorización en curso
- **Vigilancia desactivada** (punto gris): pausado por el usuario
- **Clasificando N/M** (durante el proceso de IA): progreso de la clasificación automática

Al pulsar el botón se activa/desactiva la vigilancia.

## Toast de progreso

Durante un escaneo automático aparece en la esquina el toast habitual con:
- Indicador "⚡ Auto-escaneo"
- Carpeta que lo disparó
- Barra de progreso

## Casos de uso

- Importar fotos desde una cámara o tarjeta SD: basta con copiar la carpeta en la estructura correcta
- El vigilante detecta la nueva carpeta `AÑO/EVENTO` y escanea + clasifica automáticamente
- En cuestión de minutos las fotos están disponibles en la biblioteca con sus tags

## Compatibilidad

| Sistema | Mecanismo |
|---|---|
| macOS | `fs.watch` recursivo (nativo del SO) |
| Windows | `fs.watch` recursivo (nativo del SO) |
| Linux | Polling cada 30 segundos (fallback) |
