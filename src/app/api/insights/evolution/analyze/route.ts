import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getEvolutionData, saveEvolutionAnalysis } from '@/lib/queries/evolution';
import { callOllama } from '@/lib/ollama';
import { createHash } from 'crypto';

function buildEvolutionPrompt(data: ReturnType<typeof getEvolutionData>): string {
  const { years, focals, tags, genres, hours } = data;

  // Top focal per year
  const focalByYear = new Map<number, string>();
  for (const f of focals) {
    if (!focalByYear.has(f.year)) focalByYear.set(f.year, `${f.focal_length}mm`);
  }

  // Top 3 tags per year
  const tagsByYear = new Map<number, string[]>();
  for (const t of tags) {
    if (!tagsByYear.has(t.year)) tagsByYear.set(t.year, []);
    if (tagsByYear.get(t.year)!.length < 3) tagsByYear.get(t.year)!.push(`${t.tag}(${t.percent}%)`);
  }

  // Top genre per year
  const genreByYear = new Map<number, string>();
  for (const g of genres) {
    if (!genreByYear.has(g.year)) genreByYear.set(g.year, g.genre);
  }

  const table = years.map(y => {
    const focal = focalByYear.get(y) ?? '-';
    const topTags = (tagsByYear.get(y) ?? []).join(', ') || '-';
    const genre = genreByYear.get(y) ?? '-';
    const hour = hours.find(h => h.year === y);
    const avgHour = hour ? `${Math.floor(hour.avg_hour)}:${String(Math.round((hour.avg_hour % 1) * 60)).padStart(2, '0')}` : '-';
    return `${y}: focal=${focal} | tags=${topTags} | género=${genre} | hora_media=${avgHour}`;
  }).join('\n');

  return `Eres un asistente experto en análisis fotográfico. Analiza la evolución de este fotógrafo basándote en sus datos reales de ${years[0]} a ${years[years.length - 1]}.

Datos por año:
${table}

Responde ÚNICAMENTE con este JSON (sin texto antes ni después):
{"analysis":"3-4 párrafos en español analizando la evolución real del fotógrafo. Detecta cambios de estilo concretos (ej: migración de focal, cambio de género), identifica hitos de cambio con el año exacto, y termina con una frase sobre la dirección actual. Tono personal y directo."}`;
}

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = getEvolutionData();

    if (data.years.length < 3) {
      return NextResponse.json({ error: 'Necesitas datos de al menos 3 años para el análisis' }, { status: 400 });
    }

    const prompt = buildEvolutionPrompt(data);
    const dataHash = createHash('md5').update(JSON.stringify(data.years)).digest('hex');

    let raw: string;
    try {
      raw = await callOllama(prompt, 180_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[insights/evolution/analyze] Ollama error:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Parse and normalize keys
    let analysis: string;
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');
      const obj = JSON.parse(raw.slice(start, end + 1));
      const norm = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
      analysis = norm.analysis as string;
      if (!analysis) throw new Error('missing analysis field');
    } catch {
      console.error('[insights/evolution/analyze] Parse failed — raw:', raw.substring(0, 400));
      return NextResponse.json({ error: 'El modelo no devolvió un análisis válido. Inténtalo de nuevo.' }, { status: 500 });
    }

    saveEvolutionAnalysis(dataHash, analysis);
    return NextResponse.json({ analysis, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[insights/evolution/analyze] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
