'use client';

import { useThemeEditor } from '@/hooks/useThemeEditor';

export function SaveThemePanel({ photoIds }: { photoIds: number[] }) {
  const { name, setName, saving, savedMsg, saveTheme } = useThemeEditor(photoIds);

  if (photoIds.length === 0) return null;

  return (
    <div className="search-save-theme">
      <span className="search-save-theme-label">Guardar como temática</span>
      <input
        className="search-save-theme-input"
        placeholder="Nombre de la temática…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && saveTheme()}
      />
      <button
        className="search-save-theme-btn"
        onClick={saveTheme}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {savedMsg && <span className="search-save-theme-msg">{savedMsg}</span>}
    </div>
  );
}
