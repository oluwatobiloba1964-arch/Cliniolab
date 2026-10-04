// src/app/api/admin/data-clean/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { dataCleanService } from '@/lib/db';
import type { DataCleanKey } from '@/lib/db/services/dataCleanService';

export const dynamic = 'force-dynamic';

const KEYS: DataCleanKey[] = [
  'expired_rate_limits',
  'guest_counters',
  'resolved_reports',
  'unresolved_reports',
  'resolved_feedback',
  'inactive_contributors',
  'expired_private_quizzes',
];

/** Admin Data Clean: GET lists targets with counts, POST cleans one target. Admin only. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  // Optional ?days.<key>=N lets the page preview counts for a chosen age.
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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  let body: { key?: string; olderThanDays?: number; days?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // key: "all" runs every target in one go (the "general clearing" action).
  if (body.key === 'all') {
    const overrides: Partial<Record<DataCleanKey, number>> = {};
    for (const key of KEYS) {
      const n = body.days?.[key];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 3650) overrides[key] = Math.round(n);
    }
    try {
      const { deleted, byKey } = await dataCleanService.runCleanAll(overrides);
      return NextResponse.json({ deleted, byKey });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Clean failed' }, { status: 500 });
    }
  }

  const key = KEYS.find((k) => k === body.key);
  if (!key) return NextResponse.json({ error: 'Unknown clean target' }, { status: 400 });

  try {
    const { deleted } = await dataCleanService.runClean(key, body.olderThanDays);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Clean failed' }, { status: 500 });
  }
}
