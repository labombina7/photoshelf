# Idea: Temas predeterminados generados por IA

## Descripción

Analizar la biblioteca del usuario con IA para sugerir automáticamente una lista de temas relevantes y personalizados — en lugar de partir siempre de una lista genérica vacía, el sistema propone temas basados en el contenido real de sus fotos.

## Contexto / motivación

Actualmente el usuario tiene que crear o elegir temas manualmente. Muchos usuarios no saben por dónde empezar o usan temas inconsistentes. Si la IA analiza las fotos ya escaneadas (metadatos EXIF, tags existentes, fechas, localización, descripciones generadas) puede inferir qué temas son realmente relevantes para ese usuario concreto — por ejemplo "Viajes a Europa", "Cumpleaños familiares", "Trabajo" o "Naturaleza" — y ofrecerlos como sugerencias con un solo clic para aceptar o descartar.

## Posibles señales de entrada para la IA

- Tags ya asignados por el usuario o por análisis previo
- Agrupaciones de fechas y localización (viajes recurrentes, eventos anuales)
- Metadatos de cámara (distintos dispositivos → distintos contextos de uso)
- Frecuencia de fotos por época del año o por lugar
- Temas usados en álbumes inteligentes o proyectos existentes

## Valor esperado

- Reducir la fricción de onboarding: el usuario ve temas sugeridos y los acepta/rechaza en segundos
- Mejora la coherencia del etiquetado a lo largo del tiempo
- Abre la puerta a clasificación automática de fotos nuevas contra esos temas confirmados
