# Feature: Aviso de coste estimado en Tu Estilo con proveedor cloud

## Historia de usuario

Como usuario de photoshelf con un proveedor cloud configurado (Anthropic),
quiero ver cuánto podría costarme lanzar el análisis de Tu Estilo antes de ejecutarlo,
para decidir conscientemente si quiero proceder y no llevarme una sorpresa en mi factura.

---

## Descripción

Tu Estilo analiza una muestra de fotos con visión IA — cada foto es una llamada al proveedor cloud. Con Ollama esta operación es gratuita, pero con Anthropic tiene coste real. Esta US añade un modal de confirmación con estimación de coste antes de lanzar el análisis cuando el proveedor activo es cloud.

---

## Criterios de aceptación

### Modal de confirmación (solo con proveedor cloud)
- [ ] Al pulsar "Analizar estilo", si el proveedor es cloud, se muestra un modal antes de proceder
- [ ] El modal muestra:
  - Número de fotos que se analizarán (muestra configurada en `CLASSIFY_BATCH_SIZE`)
  - Coste estimado en USD basado en el modelo seleccionado y tokens aproximados por imagen
  - Enlace a la página de precios del proveedor
  - Botones "Cancelar" y "Proceder de todas formas"
- [ ] Si el proveedor es Ollama (local), el modal NO aparece — el botón lanza directamente

### Estimación de coste
- [ ] El coste se calcula como: `nFotos × costePorImagenInput + costePorTokensOutput`
- [ ] Los precios están definidos como constantes actualizables en `src/lib/config.ts`
- [ ] La estimación se muestra como rango ("~$0.05 – $0.15") para ser conservadora

### Verificación
- [ ] Con proveedor Ollama: no aparece modal, análisis lanza directamente
- [ ] Con proveedor Anthropic: aparece modal con estimación, cancelar no lanza, proceder lanza

---

## Componentes nuevos o modificados

| Archivo | Descripción |
|---|---|
| `src/app/insights/TuEstiloClient.tsx` | Interceptar el botón con el modal de confirmación |
| `src/components/CostWarningModal.tsx` | Modal reutilizable de aviso de coste |
| `src/lib/config.ts` | Constantes de precio por modelo (`ANTHROPIC_PRICE_PER_IMAGE`) |

---

## Notas técnicas

- Los precios de Anthropic para `claude-haiku-4-5`: ~$0.80/MTok input vision. Una imagen a 1024px ≈ 1.500 tokens → ~$0.0012/imagen
- Los precios deben ser fácilmente actualizables — añadir comment con la fecha de última revisión
- El modal es el mismo componente si en el futuro se añaden más operaciones costosas

---

## Dependencias

- **US-122** — para saber qué proveedor está activo
- **US-123** — `getAIProvider()` accesible en el contexto del botón
- Parte de **EPIC-007**

## Fuera de alcance

- Tracking real de costes consumidos (requeriría webhook de facturación)
- Aviso en clasificación de fotos (potencialmente más costosa pero más incremental)
