'use client';

import { useCallback, useState } from 'react';

export interface HistoryEntry {
  query: string;
  intent: string;
  ts: number;
}

const KEY     = 'photoshelf.search.history';
const MAX     = 20;
const VISIBLE = 5;

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

export function useSearchHistory() {
  const [, forceUpdate] = useState(0);

  const recent = (): HistoryEntry[] => readHistory().slice(0, VISIBLE);

  const push = useCallback((query: string, intent: string) => {
    if (!query.trim()) return;
    const prev  = readHistory().filter(e => e.query !== query);
    const next  = [{ query, intent, ts: Date.now() }, ...prev].slice(0, MAX);
    writeHistory(next);
    forceUpdate(n => n + 1);
  }, []);

  const clear = useCallback(() => {
    writeHistory([]);
    forceUpdate(n => n + 1);
  }, []);

  return { recent, push, clear };
}
