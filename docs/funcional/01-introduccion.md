# photoshelf — Introducción

## ¿Qué es photoshelf?

**photoshelf** es una aplicación web auto-hospedada para gestionar y explorar bibliotecas de fotografía personal. Está diseñada para fotógrafos que almacenan sus fotos en disco organizadas por año y evento, y que quieren una interfaz rica para explorarlas, etiquetarlas y presentarlas — sin depender de servicios en la nube de terceros.

## Para quién está pensada

- Fotógrafos que organizan su archivo en carpetas con estructura `AÑO/EVENTO/fotos`
- Usuarios que quieren control total sobre sus datos (todo corre localmente o en su propio servidor)
- Fotógrafos que quieren aprovechar IA local (Ollama) para tagging automático sin enviar fotos a terceros

## Estructura de la biblioteca

photoshelf espera que las fotos estén organizadas en el siguiente formato de carpetas:

```
/photos
  2023/
    Boda-Julia-y-Marc/
      DSC_0001.jpg
      DSC_0002.jpg
    Viaje-Japón/
      ...
  2024/
    Cumpleaños-mamá/
      ...
```

- **Año**: carpeta numérica (e.g. `2023`)
- **Evento**: subcarpeta con nombre descriptivo (e.g. `Boda-Julia-y-Marc`)
- **Fotos**: archivos `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`, `.tif`, `.tiff`

## Funcionalidades principales

| Módulo | Descripción |
|---|---|
| Biblioteca | Vista de cuadrícula y lista por evento, con filtros |
| Línea de tiempo | Exploración cronológica con zoom Año / Mes / Día |
| Mapa | Mapa interactivo con fotos geolocalizadas |
| Estadísticas | Dashboard con métricas de la colección |
| Tags | Sistema de etiquetas manual y automático (IA) |
| Temáticas | Colecciones personalizadas con color |
| Portfolio | Proyectos fotográficos curados con IA |
| Búsqueda IA | Búsqueda semántica por concepto visual |
| Vigilancia | Escaneo automático al detectar carpetas nuevas |

## Acceso

La aplicación es accesible mediante un navegador web. Requiere una contraseña única configurada en el servidor. No hay sistema de usuarios múltiples — está concebida como herramienta personal.
