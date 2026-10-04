import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { dataCleanService } from '@/lib/db';
import type { DataCleanKey } from '@/lib/db/services/dataCleanService';

const KEYS: DataCleanKey[] = [
  'expired_rate_limits',
  'guest_counters',
  'resolved_reports',
  'open_reports',
  'resolved_feedback',
  'inactive_contributors',
  'expired_private_quizzes',
];

/** Admin Data Clean: GET lists targets with counts, PUT saves age windows, POST cleans one/all targets. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const overrides: Partial<Record<DataCleanKey, number>> = {};
  for (const key of KEYS) {
    const raw = searchParams.get(`days.${key}`);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 3650) overrides[key] = Math.round(n);
    }
  }
  const targets = await dataCleanService.listTargets(overrides);
  return NextResponse.json({ targets });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  let body: { settings?: Partial<Record<DataCleanKey, unknown>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ error: 'settings are required' }, { status: 400 });
  }

  const settings = await dataCleanService.setDataCleanSettings(body.settings);
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  let body: { key?: string; olderThanDays?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.key === 'all') {
      const result = await dataCleanService.runAllClean();
      return NextResponse.json(result);
    }

    const key = KEYS.find((k) => k === body.key);
    if (!key) return NextResponse.json({ error: 'Unknown clean target' }, { status: 400 });

    const { deleted } = await dataCleanService.runClean(key, body.olderThanDays);
    return NextResponse.json({ deleted, key });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Clean failed' }, { status: 500 });
  }
}
