# Ideas to Refine

Esta carpeta recibe ideas en bruto, todavía sin analizar ni priorizar.

## Flujo de trabajo

```
ideas/          →  todo/            →  done/
(idea en bruto)    (US refinada,       (desplegada en
                    analizada vs        producción)
                    código)
```

## ¿Cómo llegan las ideas aquí?

- **Claude Dispatch** — el agente deposita directamente un fichero `.md` con la idea
- **Sesión manual** — el equipo escribe una idea rápida sin refinar

## Formato mínimo de una idea

```markdown
# Idea: [Título]

## Descripción
Una o dos frases de qué queremos conseguir y por qué.

## Contexto / motivación
Qué problema resuelve o qué oportunidad abre.
```

## Cómo promoverla a `todo/`

Cuando una idea se refina como User Story completa (con criterios de aceptación,
componentes afectados, notas técnicas), se renombra a `US-NNN-nombre.md` y se
mueve a `specs/todo/`. El agente `/suggest-features` escribe directamente en `todo/`.
