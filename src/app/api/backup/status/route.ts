import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getBackupConfig } from '@/lib/queries/backup';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const cfg = getBackupConfig();
    const nextAt = cfg.auto_enabled && cfg.last_backup_at
      ? new Date(new Date(cfg.last_backup_at + 'Z').getTime() + cfg.auto_interval_days * 86400_000).toISOString()
      : null;

    return NextResponse.json({
      last_backup_at: cfg.last_backup_at,
      last_backup_db_path: cfg.last_backup_db_path,
      auto_enabled: cfg.auto_enabled,
      auto_interval_days: cfg.auto_interval_days,
      next_backup_at: nextAt,
    });
  } catch (err) {
    console.error('[backup/status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
