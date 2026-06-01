import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMemoriesForDate } from '@/lib/queries/memories';
import { callOllama } from '@/lib/ollama';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { date?: string; year?: number };
    const { date, year } = body;

    if (!date || !/^\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use MM-DD' }, { status: 400 });
    }
    if (!year || typeof year !== 'number') {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    const catalogId = session.catalogId ?? 1;
    const memories = getMemoriesForDate(date, catalogId);
    const yearData = memories.years.find(y => y.year === year);

    if (!yearData || yearData.count < 5) {
      return NextResponse.json({ error: 'Not enough photos for this year (minimum 5)' }, { status: 400 });
    }

    const [month, day] = date.split('-');
    const dateLabel = `${day}/${month}/${year}`;

    const tagSet = new Set<string>();
    const events = new Set<string>();
    const locations: string[] = [];

    for (const photo of yearData.photos) {
      if (photo.event) events.add(photo.event);
      if (photo.gps_lat && photo.gps_lon) {
        locations.push(`(${photo.gps_lat.toFixed(2)}, ${photo.gps_lon.toFixed(2)})`);
      }
    }

    const prompt = `Eres un asistente que ayuda a recordar momentos fotográficos.
El usuario tiene ${yearData.count} fotos tomadas el ${dateLabel}.
${events.size > 0 ? `Eventos: ${Array.from(events).join(', ')}.` : ''}
${tagSet.size > 0 ? `Temas detectados: ${Array.from(tagSet).join(', ')}.` : ''}
${locations.length > 0 ? `Coordenadas GPS: ${locations.slice(0, 3).join('; ')}.` : ''}

Escribe exactamente 1 o 2 frases evocadoras en primera persona sobre ese momento, como si fuera un recuerdo personal. Sé concreto con los detalles disponibles. No menciones que es una narrativa generada por IA. Solo devuelve las frases, sin explicaciones adicionales.`;

    const narrative = await callOllama(prompt);
    return NextResponse.json({ narrative: narrative.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[memories/narrative] Error generating narrative:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
