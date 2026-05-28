import { describe, it, expect } from 'vitest';
import { classifyQuery, normalize } from '../search/classifier';
import type { ClassifierHints } from '../search/classifier';

const hints: ClassifierHints = {
  tags: ['boda', 'naturaleza', 'retrato', 'familia', 'playa', 'montaña'],
  events: ['Boda Sara y Juan', 'Navidad 2022', 'Viaje a Portugal'],
};

describe('normalize', () => {
  it('elimina acentos y pasa a minúsculas', () => {
    expect(normalize('Montaña')).toBe('montana');
    expect(normalize('ÁVILA')).toBe('avila');
    expect(normalize('  hola  ')).toBe('hola');
    expect(normalize('Ñoño')).toBe('nono');
  });
});

describe('classifyQuery — year', () => {
  it('detecta un año de 4 dígitos', () => {
    expect(classifyQuery('2022', hints)).toEqual({ type: 'year', year: 2022 });
    expect(classifyQuery('1995', hints)).toEqual({ type: 'year', year: 1995 });
  });

  it('NO clasifica como year si está fuera del rango 1800-2100', () => {
    expect(classifyQuery('1700', hints).type).not.toBe('year');
    expect(classifyQuery('9999', hints).type).not.toBe('year');
  });

  it('NO clasifica como year si tiene más dígitos', () => {
    expect(classifyQuery('20221', hints).type).not.toBe('year');
  });
});

describe('classifyQuery — tag', () => {
  it('detecta tag exacto (case-insensitive)', () => {
    expect(classifyQuery('boda', hints)).toEqual({ type: 'tag', name: 'boda' });
    expect(classifyQuery('BODA', hints)).toEqual({ type: 'tag', name: 'boda' });
  });

  it('detecta tag con acento diferente', () => {
    // 'montaña' en hints, query con ñ
    expect(classifyQuery('montaña', hints)).toEqual({ type: 'tag', name: 'montaña' });
  });

  it('NO detecta tag si no es coincidencia exacta', () => {
    expect(classifyQuery('bodas', hints).type).not.toBe('tag');
    expect(classifyQuery('mi familia', hints).type).not.toBe('tag');
  });
});

describe('classifyQuery — event', () => {
  it('detecta evento conocido (case-insensitive)', () => {
    expect(classifyQuery('Boda Sara y Juan', hints)).toEqual({
      type: 'event',
      name: 'Boda Sara y Juan',
    });
  });

  it('detecta evento normalizado', () => {
    expect(classifyQuery('boda sara y juan', hints)).toEqual({
      type: 'event',
      name: 'Boda Sara y Juan',
    });
  });
});

describe('classifyQuery — ai por signo de pregunta', () => {
  it('detecta pregunta con ¿', () => {
    expect(classifyQuery('¿dónde están mis fotos de montaña?', hints)).toEqual({
      type: 'ai',
      query: '¿dónde están mis fotos de montaña?',
    });
  });

  it('detecta pregunta con ?', () => {
    expect(classifyQuery('fotos de verano?', hints)).toEqual({
      type: 'ai',
      query: 'fotos de verano?',
    });
  });
});

describe('classifyQuery — ai por número de palabras', () => {
  it('clasifica como ai con 4 o más palabras', () => {
    expect(classifyQuery('fotos de la playa', hints).type).toBe('ai');
    expect(classifyQuery('retratos en blanco y negro', hints).type).toBe('ai');
  });

  it('NO clasifica como ai con 3 palabras o menos', () => {
    const result = classifyQuery('fotos de verano', hints);
    // 3 palabras: puede ser fulltext o ai por token descriptivo, nunca por conteo
    expect(['fulltext', 'ai']).toContain(result.type);
    // pero "verano" no está en DESCRIPTIVE_TOKENS, así que debería ser fulltext
    expect(classifyQuery('fotos de verano', hints).type).toBe('fulltext');
  });
});

describe('classifyQuery — ai por palabra descriptiva', () => {
  it('detecta color', () => {
    expect(classifyQuery('fotos azul', hints).type).toBe('ai');
  });

  it('detecta emoción', () => {
    expect(classifyQuery('momento intimo', hints).type).toBe('ai');
  });

  it('detecta escena', () => {
    expect(classifyQuery('foto atardecer', hints).type).toBe('ai');
  });

  it('detecta adjetivo fotográfico', () => {
    expect(classifyQuery('imagen bokeh', hints).type).toBe('ai');
  });
});

describe('classifyQuery — fulltext', () => {
  it('clasifica términos simples sin match como fulltext', () => {
    expect(classifyQuery('vacaciones', hints)).toEqual({ type: 'fulltext', query: 'vacaciones' });
    expect(classifyQuery('IMG_4532', hints)).toEqual({ type: 'fulltext', query: 'IMG_4532' });
    expect(classifyQuery('jorge', hints)).toEqual({ type: 'fulltext', query: 'jorge' });
  });

  it('respeta la query original (sin normalizar) en fulltext', () => {
    const result = classifyQuery('Vacaciones', hints);
    expect(result).toEqual({ type: 'fulltext', query: 'Vacaciones' });
  });

  it('query vacía devuelve fulltext', () => {
    expect(classifyQuery('', hints)).toEqual({ type: 'fulltext', query: '' });
    expect(classifyQuery('  ', hints)).toEqual({ type: 'fulltext', query: '' });
  });
});

describe('classifyQuery — prioridad (tag antes que ai)', () => {
  it('un tag conocido tiene prioridad sobre palabras descriptivas', () => {
    // 'retrato' está en hints.tags Y en DESCRIPTIVE_TOKENS → gana tag
    expect(classifyQuery('retrato', hints)).toEqual({ type: 'tag', name: 'retrato' });
  });

  it('un año tiene prioridad sobre todo', () => {
    // aunque '2022' pudiera coincidir con algo, el año gana
    expect(classifyQuery('2022', hints)).toEqual({ type: 'year', year: 2022 });
  });
});
