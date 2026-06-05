import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { setBackupConfig, getBackupConfig } from '@/lib/queries/backup';

const VALID_INTERVALS = [1, 3, 7, 14, 30];

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { auto_enabled?: boolean; auto_interval_days?: number };

  if (body.auto_interval_days !== undefined && !VALID_INTERVALS.includes(body.auto_interval_days)) {
    return NextResponse.json({ error: `Intervalo no válido. Valores permitidos: ${VALID_INTERVALS.join(', ')}` }, { status: 400 });
  }

  try {
    setBackupConfig({ auto_enabled: body.auto_enabled, auto_interval_days: body.auto_interval_days });
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
    console.error('[backup/config] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
