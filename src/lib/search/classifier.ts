/**
 * US-029 — Clasificador de intención de búsqueda
 *
 * Módulo puro: sin dependencias externas, síncrono, portable cliente/servidor.
 * Decide el tipo de búsqueda en < 1ms sin llamar a ninguna API ni a Ollama.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SearchIntent =
  | { type: 'year';     year: number }
  | { type: 'tag';      name: string }
  | { type: 'event';    name: string }
  | { type: 'fulltext'; query: string }
  | { type: 'ai';       query: string };

export interface ClassifierHints {
  /** Nombres de tags conocidos en el catálogo activo */
  tags: string[];
  /** Nombres de eventos conocidos en el catálogo activo */
  events: string[];
}

// ─── Normalización ────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ñ: 'n', ç: 'c',
};

/** trim + lowercase + quitar acentos (sin Intl.Collator para máxima portabilidad) */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[áàâäãéèêëíìîïóòôöõúùûüñç]/g, c => ACCENT_MAP[c] ?? c);
}

// ─── Palabras descriptivas que fuerzan modo IA ────────────────────────────────
// Colores, emociones, escenas, adjetivos fotográficos frecuentes en español.

const DESCRIPTIVE_TOKENS = new Set([
  // Colores y tonos
  'rojo', 'azul', 'verde', 'amarillo', 'naranja', 'morado', 'violeta',
  'rosa', 'negro', 'blanco', 'gris', 'dorado', 'plateado', 'oscuro', 'claro',
  'colorido', 'brillante', 'palido', 'saturado', 'desaturado',
  // Emociones y atmósfera
  'feliz', 'triste', 'melancolico', 'alegre', 'romantico', 'nostalgico',
  'intimo', 'dramatico', 'sereno', 'tranquilo', 'energico', 'emotivo',
  // Escenas y contexto
  'atardecer', 'amanecer', 'nocturno', 'noche', 'lluvia', 'nieve', 'niebla',
  'soleado', 'nublado', 'tormenta', 'horizonte', 'silueta', 'reflejo',
  'contraluz', 'panoramico', 'aereo', 'subacuatico',
  // Adjetivos fotográficos
  'borroso', 'nitido', 'enfocado', 'desenfocado', 'macro', 'gran', 'angular',
  'teleobjetivo', 'bokeh', 'exposicion', 'larga', 'rapida',
  // Descriptores de composición
  'primer', 'plano', 'retrato', 'paisaje', 'arquitectura', 'abstracto',
  'minimalista', 'simetrico', 'geometrico',
]);

// ─── Clasificador ─────────────────────────────────────────────────────────────

/**
 * Clasifica una query de búsqueda sin llamar a ninguna API externa.
 *
 * Reglas en orden de prioridad:
 * 1. Solo 4 dígitos numéricos → year
 * 2. Coincidencia exacta con tag conocido (normalizado) → tag
 * 3. Coincidencia exacta con nombre de evento → event
 * 4. Contiene '?' o '¿' → ai
 * 5. ≥ 4 palabras → ai
 * 6. Algún token es una palabra descriptiva de la lista → ai
 * 7. Resto → fulltext
 */
export function classifyQuery(query: string, hints: ClassifierHints): SearchIntent {
  const raw = query.trim();
  if (!raw) return { type: 'fulltext', query: raw };

  // 1. Año exacto (4 dígitos, valor razonable)
  if (/^\d{4}$/.test(raw)) {
    const year = parseInt(raw, 10);
    if (year >= 1800 && year <= 2100) {
      return { type: 'year', year };
    }
  }

  const norm = normalize(raw);

  // 2. Tag conocido (normalizado)
  const normTags = hints.tags.map(t => normalize(t));
  const tagIdx = normTags.indexOf(norm);
  if (tagIdx !== -1) {
    return { type: 'tag', name: hints.tags[tagIdx] };
  }

  // 3. Evento conocido (normalizado)
  const normEvents = hints.events.map(e => normalize(e));
  const eventIdx = normEvents.indexOf(norm);
  if (eventIdx !== -1) {
    return { type: 'event', name: hints.events[eventIdx] };
  }

  // 4. Contiene signo de pregunta → intención conversacional
  if (raw.includes('?') || raw.includes('¿')) {
    return { type: 'ai', query: raw };
  }

  // 5. ≥ 4 palabras → lenguaje natural
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) {
    return { type: 'ai', query: raw };
  }

  // 6. Algún token es una palabra descriptiva
  if (tokens.some(t => DESCRIPTIVE_TOKENS.has(t))) {
    return { type: 'ai', query: raw };
  }

  // 7. Fallback: búsqueda por texto libre
  return { type: 'fulltext', query: raw };
}
