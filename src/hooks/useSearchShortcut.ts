'use client';

import { useEffect } from 'react';

/**
 * Registers a global ⌘K / Ctrl+K keyboard shortcut that calls `onTrigger`.
 * Safe to use in Server Component trees — the import is client-only.
 */
export function useSearchShortcut(onTrigger: () => void): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onTrigger();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onTrigger]);
}
