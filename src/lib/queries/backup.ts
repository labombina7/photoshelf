import { getDb } from '@/lib/db';

export interface BackupConfig {
  auto_enabled: boolean;
  auto_interval_days: number;
  last_backup_at: string | null;
  last_backup_db_path: string | null;
}

export function getBackupConfig(): BackupConfig {
  const row = getDb().prepare(
    `SELECT auto_enabled, auto_interval_days, last_backup_at, last_backup_db_path FROM backup_config WHERE id = 1`
  ).get() as { auto_enabled: number; auto_interval_days: number; last_backup_at: string | null; last_backup_db_path: string | null };

  return {
    auto_enabled: row.auto_enabled === 1,
    auto_interval_days: row.auto_interval_days,
    last_backup_at: row.last_backup_at,
    last_backup_db_path: row.last_backup_db_path,
  };
}

export function setBackupConfig(patch: Partial<Pick<BackupConfig, 'auto_enabled' | 'auto_interval_days'>>): BackupConfig {
  if (patch.auto_enabled !== undefined) {
    getDb().prepare(`UPDATE backup_config SET auto_enabled = ? WHERE id = 1`).run(patch.auto_enabled ? 1 : 0);
  }
  if (patch.auto_interval_days !== undefined) {
    getDb().prepare(`UPDATE backup_config SET auto_interval_days = ? WHERE id = 1`).run(patch.auto_interval_days);
  }
  return getBackupConfig();
}

export function updateLastBackup(dbPath: string): void {
  getDb().prepare(
    `UPDATE backup_config SET last_backup_at = datetime('now'), last_backup_db_path = ? WHERE id = 1`
  ).run(dbPath);
}

export function isAutoBackupDue(): boolean {
  const cfg = getBackupConfig();
  if (!cfg.auto_enabled) return false;
  if (!cfg.last_backup_at) return true;
  const last = new Date(cfg.last_backup_at + 'Z').getTime();
  const dueMs = cfg.auto_interval_days * 24 * 60 * 60 * 1000;
  return Date.now() - last >= dueMs;
}
