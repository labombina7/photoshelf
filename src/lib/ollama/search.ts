import { callOllama } from './client';
import { extractJsonObject, escapeXml } from './utils';

export async function parseSearchQuery(prompt: string): Promise<{ year: number | null; concept: string; tags: string[] }> {
  const raw = await callOllama(
    `Extract photo search parameters from this query. Reply with JSON only, no explanation.
Tags must only come from these exact values: "b&w", "color", portrait, landscape, street, fashion, editorial, architecture, macro, product, documentary, wildlife, travel, sport, abstract, personal, work, event, nature.
Only include tags that are explicitly required by the query — do NOT add broad style tags unless specifically mentioned.
Query: <user_query>${escapeXml(prompt)}</user_query>
JSON format: {"year": null or number, "concept": "english concept", "tags": ["tag1", "tag2"]}
Example for "fotos de naturaleza": {"year": null, "concept": "nature", "tags": ["nature"]}
Example for "retratos en blanco y negro": {"year": null, "concept": "black and white portrait", "tags": ["b&w", "portrait"]}
Example for "fotos en blanco y negro": {"year": null, "concept": "black and white", "tags": ["b&w"]}
Example for "paisajes de viaje 2023": {"year": 2023, "concept": "travel landscapes", "tags": ["landscape", "travel"]}
JSON:`
  );

  try {
    const json = extractJsonObject(raw);
    const parsed = JSON.parse(json);
    return {
      year: parsed.year ?? null,
      concept: parsed.concept ?? prompt,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { year: null, concept: prompt, tags: [] };
  }
}
