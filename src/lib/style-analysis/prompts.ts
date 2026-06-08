import type { PeriodStyleSummary } from '@/lib/types';

function formatSummary(s: PeriodStyleSummary): string {
  const lines: string[] = [];
  if (s.topCamera) lines.push(`- Cámara predominante: ${s.topCamera}`);
  if (s.topFocalLengths?.length) lines.push(`- Focales más usadas: ${s.topFocalLengths.map(f => `${f}mm`).join(', ')}`);
  if (s.topApertures?.length) lines.push(`- Aperturas más usadas: ${s.topApertures.map(a => `f/${a}`).join(', ')}`);
  if (s.topIsos?.length) lines.push(`- ISOs más usados: ${s.topIsos.join(', ')}`);
  if (s.avgHourOfDay !== null) {
    const h = Math.floor(s.avgHourOfDay);
    const m = Math.round((s.avgHourOfDay - h) * 60);
    lines.push(`- Hora media de disparo: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  if (s.topGenres.length) lines.push(`- Géneros: ${s.topGenres.join(', ')}`);
  if (s.topTags.length) lines.push(`- Tags más frecuentes: ${s.topTags.slice(0, 10).join(', ')}`);
  lines.push(`- Fotos analizadas: ${s.photoCount}`);
  return lines.join('\n');
}

export function buildMonthlySynthesisPrompt(
  month: string,
  current: PeriodStyleSummary,
  previousProfile: string | null,
): string {
  const prevSection = previousProfile
    ? `\n## Perfil del mes anterior\n${previousProfile}\n`
    : '';

  return `Eres un asistente experto en análisis fotográfico. Analiza los datos del fotógrafo y genera una síntesis narrativa personal.

## Datos del mes ${month}

${formatSummary(current)}
${prevSection}
## Instrucciones

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "narrative": "texto narrativo de 3-5 párrafos en español, tono personal ('este mes has...', 'se nota que...')",
  "highlights": ["observación clave 1", "observación clave 2", "observación clave 3"],
  "trend": "una frase sobre la dirección actual del estilo"
}

- Responde en español
- Tono personal, dirigido al fotógrafo
- Compara con el mes anterior si hay datos
- Incluye observaciones concretas sobre equipo, géneros y técnica
- Los highlights deben ser específicos, no genéricos

Respuesta (empieza directamente con {, sin texto previo):
{`;
}

export function buildAnnualSynthesisPrompt(year: number, monthlyProfiles: string[]): string {
  const profilesText = monthlyProfiles
    .map((p, i) => `### Mes ${i + 1}\n${p}`)
    .join('\n\n');

  return `Eres un asistente experto en análisis fotográfico. Genera un relato autobiográfico del año fotográfico.

## Perfiles mensuales del año ${year}

${profilesText}

## Instrucciones

Responde ÚNICAMENTE con un objeto JSON válido:
{
  "narrative": "relato narrativo del año completo en español, en 4-6 párrafos cronológicos, tono autobiográfico ('en este año...')",
  "highlights": ["hito fotográfico 1", "hito fotográfico 2", "hito fotográfico 3"],
  "trend": "una frase sobre la evolución global del estilo durante este año"
}

- Responde en español
- Usa los 12 perfiles para construir una narrativa coherente del año
- Identifica qué definió ese año fotográficamente
- Menciona equipo, géneros y momentos clave

Respuesta (empieza directamente con {, sin texto previo):
{`;
}

export function buildHistoricalSamplePrompt(
  year: string,
  summary: PeriodStyleSummary,
): string {
  return `Eres un asistente experto en análisis fotográfico. Genera un perfil histórico conciso de un año del catálogo.

## Datos del año ${year}

${formatSummary(summary)}

## Instrucciones

Responde ÚNICAMENTE con un objeto JSON válido:
{
  "narrative": "descripción narrativa del año en español, 2-3 párrafos, tono histórico ('en ${year}...')",
  "highlights": ["característica 1 de ese año", "característica 2"],
  "trend": "una frase que resume el estilo fotográfico de ese año"
}

- Responde en español
- Tono histórico y descriptivo
- Sé conciso — es un perfil de muestra representativa

Respuesta (empieza directamente con {, sin texto previo):
{`;
}
