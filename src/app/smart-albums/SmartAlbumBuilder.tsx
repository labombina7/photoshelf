'use client';

import { useEffect, useRef, useState } from 'react';
import { IconPlus, IconTrash } from '@/components/Icons';
import type { AlbumRule, RuleField, RuleOp } from '@/lib/smartAlbumQuery';

interface Theme { id: number; name: string; color: string }

interface SmartAlbumBuilderProps {
  initialName?: string;
  initialRules?: AlbumRule[];
  themes: Theme[];
  onSave: (name: string, rules: AlbumRule[]) => Promise<void>;
  onClose: () => void;
}

const FIELD_LABELS: Record<RuleField, string> = {
  year: 'Año',
  tag: 'Tag',
  theme: 'Temática',
  favorite: 'Favorita',
  camera: 'Cámara',
  no_tags: 'Sin tags',
};

function RuleRow({
  rule,
  themes,
  onChange,
  onRemove,
}: {
  rule: AlbumRule;
  themes: Theme[];
  onChange: (r: AlbumRule) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        className="tag-input"
        style={{ flex: '0 0 auto', minWidth: 110 }}
        value={rule.field}
        onChange={e => {
          const field = e.target.value as RuleField;
          const defaults: Record<RuleField, AlbumRule> = {
            year:     { field: 'year',     op: 'eq',      value: String(new Date().getFullYear()) },
            tag:      { field: 'tag',      op: 'contains', value: '' },
            theme:    { field: 'theme',    op: 'eq',      value: themes[0] ? String(themes[0].id) : '' },
            favorite: { field: 'favorite', op: 'is_true' },
            camera:   { field: 'camera',   op: 'contains', value: '' },
            no_tags:  { field: 'no_tags',  op: 'is_empty' },
          };
          onChange(defaults[field]);
        }}
      >
        {(Object.keys(FIELD_LABELS) as RuleField[]).map(f => (
          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
        ))}
      </select>

      {rule.field === 'year' && (
        <>
          <select
            className="tag-input"
            style={{ flex: '0 0 auto', minWidth: 90 }}
            value={rule.op}
            onChange={e => onChange({ ...rule, op: e.target.value as RuleOp })}
          >
            <option value="eq">igual a</option>
            <option value="gte">desde</option>
            <option value="lte">hasta</option>
          </select>
          <input
            className="tag-input"
            type="number"
            style={{ flex: '1 1 70px', minWidth: 70 }}
            value={rule.value ?? ''}
            min={1900}
            max={2100}
            onChange={e => onChange({ ...rule, value: e.target.value })}
          />
        </>
      )}

      {rule.field === 'tag' && (
        <input
          className="tag-input"
          style={{ flex: 1 }}
          placeholder="nombre del tag"
          value={rule.value ?? ''}
          onChange={e => onChange({ ...rule, value: e.target.value })}
        />
      )}

      {rule.field === 'theme' && (
        <select
          className="tag-input"
          style={{ flex: 1 }}
          value={rule.value ?? ''}
          onChange={e => onChange({ ...rule, value: e.target.value })}
        >
          {themes.length === 0 && <option value="">Sin temáticas</option>}
          {themes.map(t => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      )}

      {rule.field === 'favorite' && (
        <select
          className="tag-input"
          style={{ flex: 1 }}
          value={rule.op}
          onChange={e => onChange({ ...rule, op: e.target.value as RuleOp })}
        >
          <option value="is_true">sí</option>
          <option value="is_false">no</option>
        </select>
      )}

      {rule.field === 'camera' && (
        <input
          className="tag-input"
          style={{ flex: 1 }}
          placeholder="p.ej. Fuji, Canon…"
          value={rule.value ?? ''}
          onChange={e => onChange({ ...rule, value: e.target.value })}
        />
      )}

      {rule.field === 'no_tags' && (
        <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 13 }}>fotos sin ningún tag</span>
      )}

      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, flexShrink: 0 }}
        title="Eliminar regla"
        aria-label="Eliminar regla"
      >
        <IconTrash size={13} />
      </button>
    </div>
  );
}

export default function SmartAlbumBuilder({
  initialName = '',
  initialRules = [],
  themes,
  onSave,
  onClose,
}: SmartAlbumBuilderProps) {
  const [name, setName] = useState(initialName);
  const [rules, setRules] = useState<AlbumRule[]>(initialRules);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/smart-albums/preview?rules=${encodeURIComponent(JSON.stringify(rules))}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPreviewCount(data.count); })
        .catch(() => {});
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rules]);

  function addRule() {
    setRules(prev => [...prev, { field: 'tag', op: 'contains', value: '' }]);
  }

  function updateRule(idx: number, rule: AlbumRule) {
    setRules(prev => prev.map((r, i) => i === idx ? rule : r));
  }

  function removeRule(idx: number) {
    setRules(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), rules);
    } catch {
      setError('Error al guardar el álbum');
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24,
        width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {initialName ? 'Editar álbum' : 'Nuevo álbum inteligente'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1, padding: 4 }}
            aria-label="Cerrar"
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Nombre</label>
          <input
            className="tag-input"
            placeholder="Nombre del álbum"
            value={name}
            autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Reglas (todas se combinan con AND)</label>
          {rules.map((rule, idx) => (
            <RuleRow
              key={idx}
              rule={rule}
              themes={themes}
              onChange={r => updateRule(idx, r)}
              onRemove={() => removeRule(idx)}
            />
          ))}
          <button
            className="sidebar-item"
            style={{ color: 'var(--text-tertiary)', fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            onClick={addRule}
          >
            <IconPlus size={13} />
            Añadir regla
          </button>
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {previewCount === null ? 'Calculando…' : `${previewCount.toLocaleString('es')} fotos coinciden`}
        </div>

        {error && <p style={{ margin: 0, color: '#e74c3c', fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="btn-small"
            onClick={onClose}
            style={{ background: 'var(--border)', color: 'var(--text)' }}
          >Cancelar</button>
          <button
            className="btn-small"
            onClick={handleSave}
            disabled={saving}
          >{saving ? 'Guardando…' : 'Guardar álbum'}</button>
        </div>
      </div>
    </div>
  );
}
