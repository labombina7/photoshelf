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

Responde ÚNICAMENTE con este JSON (sin texto antes ni después):
{"narrative":"2 párrafos en español, tono personal ('este mes has...', 'se nota que...')","highlights":["observación 1","observación 2","observación 3"],"trend":"una frase sobre la dirección del estilo"}`;
}

export function buildAnnualSynthesisPrompt(year: number, monthlyProfiles: string[]): string {
  const profilesText = monthlyProfiles
    .map((p, i) => `### Mes ${i + 1}\n${p}`)
    .join('\n\n');

  return `Eres un asistente experto en análisis fotográfico. Genera un relato autobiográfico del año fotográfico.

## Perfiles mensuales del año ${year}

${profilesText}

## Instrucciones

Responde ÚNICAMENTE con este JSON (sin texto antes ni después):
{"narrative":"2-3 párrafos en español, tono autobiográfico ('en este año...')","highlights":["hito 1","hito 2","hito 3"],"trend":"una frase sobre la evolución del estilo"}`;
}

export function buildHistoricalSamplePrompt(
  year: string,
  summary: PeriodStyleSummary,
): string {
  return `Eres un asistente experto en análisis fotográfico. Genera un perfil histórico conciso de un año del catálogo.

## Datos del año ${year}

${formatSummary(summary)}

## Instrucciones

Responde ÚNICAMENTE con este JSON (sin texto antes ni después):
{"narrative":"1-2 párrafos en español, tono histórico ('en ${year}...')","highlights":["característica 1","característica 2"],"trend":"una frase que resume el estilo de ese año"}`;
}
