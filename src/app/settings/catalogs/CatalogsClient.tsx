'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconTrash, IconEdit } from '@/components/Icons';
import { useModal } from '@/components/ModalProvider';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface BackupStatus {
  last_backup_at: string | null;
  last_backup_db_path: string | null;
  auto_enabled: boolean;
  auto_interval_days: number;
  next_backup_at: string | null;
}

const INTERVAL_OPTIONS = [1, 3, 7, 14, 30];

interface Props {
  catalogs: CatalogRow[];
  activeCatalogId: number;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  sidebarCatalogs?: CatalogRow[];
}

export default function CatalogsClient({
  catalogs: initialCatalogs,
  activeCatalogId,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  sidebarCatalogs = [],
}: Props) {
  const router = useRouter();
  const { confirm, alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [catalogs, setCatalogs] = useState(initialCatalogs);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Backup state
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/backup/status')
      .then(r => r.json())
      .then(d => setBackupStatus(d as BackupStatus))
      .catch(() => null);
  }, []);

  async function refresh() {
    const res = await fetch('/api/catalogs');
    if (res.ok) {
      const data = await res.json() as { catalogs: CatalogRow[] };
      setCatalogs(data.catalogs);
    }
  }

  async function createCatalog() {
    setCreateError(null);
    if (!newName.trim()) { setCreateError('El nombre es obligatorio'); return; }
    if (!newPath.trim()) { setCreateError('La ruta es obligatoria'); return; }
    const res = await fetch('/api/catalogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), path: newPath.trim() }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      setCreateError(err.error ?? 'Error al crear el catálogo');
      return;
    }
    setNewName('');
    setNewPath('');
    await refresh();
    startTransition(() => router.refresh());
  }

  async function saveEdit(id: number) {
    setEditError(null);
    if (!editName.trim()) { setEditError('El nombre es obligatorio'); return; }

    const currentCatalog = catalogs.find(c => c.id === id);
    const pathChanged = editPath.trim() !== '' && editPath.trim() !== currentCatalog?.path;

    // Confirm before changing the path of the Principal catalog
    if (pathChanged && id === 1) {
      const ok = await confirm(
        `Vas a cambiar la ruta del catálogo Principal:\n\nAnterior: ${currentCatalog?.path}\nNueva: ${editPath.trim()}\n\nAsegúrate de que la nueva ruta apunta a la misma carpeta de fotos. Si es incorrecta, ninguna foto será accesible hasta corregirla.`,
        { title: 'Cambiar ruta del catálogo Principal', confirmLabel: 'Sí, cambiar ruta', danger: true },
      );
      if (!ok) return;
    }

    // Update name
    const resName = await fetch(`/api/catalogs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!resName.ok) {
      const err = await resName.json() as { error?: string };
      setEditError(err.error ?? 'Error al renombrar');
      return;
    }

    // Update path if changed
    if (pathChanged) {
      const resPath = await fetch(`/api/catalogs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editPath.trim() }),
      });
      if (!resPath.ok) {
        const err = await resPath.json() as { error?: string };
        setEditError(err.error ?? 'Error al actualizar la ruta');
        return;
      }
    }

    setEditingId(null);
    await refresh();
    startTransition(() => router.refresh());
  }

  async function deleteCatalog(id: number, name: string) {
    const ok = await confirm(
      `¿Eliminar el catálogo "${name}"? Se eliminarán también todas las fotos registradas en él.`,
      { title: 'Eliminar catálogo', confirmLabel: 'Eliminar', danger: true },
    );
    if (!ok) return;
    const res = await fetch(`/api/catalogs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      await alert(err.error ?? 'Error al eliminar', { title: 'Error' });
      return;
    }
    await refresh();
    startTransition(() => router.refresh());
  }

  async function switchTo(id: number) {
    await fetch('/api/catalogs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: id }),
    });
    // Hard navigation — bypasses Next.js router cache and re-reads session cookie
    window.location.href = '/library';
  }

  async function runBackupNow() {
    setBackupRunning(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json() as { db_path?: string; db_size_bytes?: number; error?: string };
      if (!res.ok) {
        setBackupError(data.error ?? 'Error al crear el backup');
      } else {
        const mb = ((data.db_size_bytes ?? 0) / 1024 / 1024).toFixed(1);
        setBackupSuccess(`Backup creado (${mb} MB)`);
        const s = await fetch('/api/backup/status').then(r => r.json()) as BackupStatus;
        setBackupStatus(s);
      }
    } catch {
      setBackupError('Error de red al crear el backup');
    } finally {
      setBackupRunning(false);
    }
  }

  async function activateAutoBackup() {
    setBackupBannerDismissed(true);
    setBackupStatus(s => s ? { ...s, auto_enabled: true, auto_interval_days: 7 } : s);
    await updateBackupConfig({ auto_enabled: true, auto_interval_days: 7 });
  }

  async function updateBackupConfig(patch: { auto_enabled?: boolean; auto_interval_days?: number }) {
    try {
      const res = await fetch('/api/backup/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const s = await res.json() as BackupStatus;
        setBackupStatus(s);
      }
    } catch {
      // silent — UI already reflects optimistic state
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Nunca';
    return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatPath(p: string | null): string {
    if (!p) return '';
    const parts = p.split('/');
    return parts[parts.length - 1] ?? p;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  ), []));

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={sidebarCatalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div style={{ padding: '24px 32px', maxWidth: 640 }}>

          {/* Backup disabled warning banner */}
          {backupStatus && !backupStatus.auto_enabled && !backupBannerDismissed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', marginBottom: 20,
              borderRadius: 'var(--radius-sm)',
              background: '#fff8ed', border: '1px solid #f5c36a',
              fontSize: 13,
            }}>
              <span style={{ flex: 1, color: '#92600a' }}>
                ⚠️ Los backups automáticos están desactivados. Actívalos para proteger tus datos.
              </span>
              <button
                className="btn-small"
                onClick={activateAutoBackup}
                style={{ flexShrink: 0 }}
              >
                Activar ahora
              </button>
              <button
                onClick={() => setBackupBannerDismissed(true)}
                aria-label="Cerrar aviso"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#92600a', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          )}

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Cada catálogo apunta a una carpeta de fotos independiente. Escribe la ruta completa tal como aparece en el NAS.
          </p>

          {/* Add new catalog — at the top so it's accessible on mobile without scrolling */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Añadir catálogo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="tag-input"
                placeholder="Nombre (p.ej. Archivo 2010–2015)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%' }}
              />
              <input
                className="tag-input"
                placeholder="Ruta de la carpeta (p.ej. /volume1/homes/javi/MobileBackup)"
                value={newPath}
                onChange={e => setNewPath(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCatalog(); }}
                style={{ width: '100%' }}
              />
              {createError && (
                <div style={{ fontSize: 12, color: 'var(--danger, #e05252)' }}>{createError}</div>
              )}
              <div>
                <button className="btn-small" onClick={createCatalog} disabled={isPending}>
                  Crear catálogo
                </button>
              </div>
            </div>
          </div>

          {/* Catalog list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {catalogs.map(cat => (
              <div key={cat.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                border: `1px solid ${cat.id === activeCatalogId ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                background: cat.id === activeCatalogId ? 'rgba(var(--accent-rgb), 0.06)' : 'transparent',
              }}>
                {editingId === cat.id ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cat.id === 1 && (
                      <div style={{ fontSize: 11, color: '#ca8a04', background: 'rgba(202,138,4,0.08)', borderRadius: 4, padding: '5px 8px' }}>
                        ⚠️ Cambiar la ruta del catálogo Principal afecta a todas las fotos indexadas. Se pedirá confirmación.
                      </div>
                    )}
                    <input
                      className="tag-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                      placeholder="Nombre"
                      style={{ width: '100%' }}
                    />
                    <input
                      className="tag-input"
                      value={editPath}
                      onChange={e => setEditPath(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null); }}
                      placeholder="Ruta de la carpeta"
                      style={{ width: '100%' }}
                    />
                    {editError && (
                      <div style={{ fontSize: 12, color: 'var(--danger, #e05252)' }}>{editError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-small" onClick={() => saveEdit(cat.id)}>Guardar</button>
                      <button
                        className="btn-small"
                        onClick={() => { setEditingId(null); setEditError(null); }}
                        style={{ background: 'var(--border)', color: 'var(--text)' }}
                      >Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cat.name}
                        {cat.id === activeCatalogId && (
                          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            activo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.path} · {cat.photo_count.toLocaleString('es')} fotos
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {cat.id !== activeCatalogId && (
                        <button
                          className="btn-small"
                          onClick={() => switchTo(cat.id)}
                          disabled={isPending}
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditPath(cat.path); setEditError(null); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                        title="Renombrar"
                      >
                        <IconEdit size={14} />
                      </button>
                      {cat.id !== 1 && (
                        <button
                          onClick={() => deleteCatalog(cat.id, cat.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                          title="Eliminar"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Backup block ─────────────────────────────────────────── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Backup de base de datos</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Guarda una copia de todos los tags, favoritos y proyectos. Los últimos 10 backups se conservan automáticamente.
            </div>

            {/* Last backup info */}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
              {backupStatus ? (
                <>
                  Último backup: <span style={{ color: 'var(--text-secondary)' }}>{formatDate(backupStatus.last_backup_at)}</span>
                  {backupStatus.last_backup_db_path && (
                    <span style={{ marginLeft: 6, opacity: 0.6 }}>· {formatPath(backupStatus.last_backup_db_path)}</span>
                  )}
                </>
              ) : (
                <span style={{ opacity: 0.5 }}>Cargando…</span>
              )}
            </div>

            {/* Manual backup button */}
            <div style={{ marginBottom: 20 }}>
              <button
                className="btn-small"
                onClick={runBackupNow}
                disabled={backupRunning}
                style={{ minWidth: 160 }}
              >
                {backupRunning ? 'Creando backup…' : 'Crear backup ahora'}
              </button>
              {backupError && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger, #e05252)' }}>{backupError}</div>
              )}
              {backupSuccess && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--success, #4ade80)' }}>{backupSuccess}</div>
              )}
            </div>

            {/* Auto backup toggle */}
            {backupStatus && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={backupStatus.auto_enabled}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setBackupStatus(s => s ? { ...s, auto_enabled: enabled } : s);
                      updateBackupConfig({ auto_enabled: enabled });
                    }}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13 }}>Backup automático</span>
                </label>

                {backupStatus.auto_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 25, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cada</span>
                    <select
                      value={backupStatus.auto_interval_days}
                      onChange={e => {
                        const days = Number(e.target.value);
                        setBackupStatus(s => s ? { ...s, auto_interval_days: days } : s);
                        updateBackupConfig({ auto_interval_days: days });
                      }}
                      style={{
                        background: 'var(--surface-2, var(--border))',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        fontSize: 13,
                        padding: '3px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      {INTERVAL_OPTIONS.map(d => (
                        <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                      ))}
                    </select>
                    {backupStatus.next_backup_at && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        · próximo {formatDate(backupStatus.next_backup_at)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
