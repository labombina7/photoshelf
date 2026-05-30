/**
 * Robustly extract the first JSON object from an Ollama response.
 * Handles markdown code fences and uses bracket-counting to avoid
 * swallowing trailing text after the closing brace.
 */
export function extractJsonObject(raw: string): string {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) return '{}';

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape)                    { escape = false; continue; }
    if (ch === '\\' && inString)   { escape = true;  continue; }
    if (ch === '"')                { inString = !inString; continue; }
    if (inString)                  { continue; }
    if (ch === '{')                { depth++; }
    if (ch === '}')                { depth--; if (depth === 0) return cleaned.slice(start, i + 1); }
  }
  return cleaned.slice(start);
}

/** Escapes user-controlled strings before embedding them in Ollama prompts. */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
