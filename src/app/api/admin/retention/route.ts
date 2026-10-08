import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { retentionService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const [settings, usage] = await Promise.all([
    retentionService.getRetentionSettings(),
    retentionService.getDataUsage(),
  ]);
  return NextResponse.json({ settings, usage, defaults: retentionService.DEFAULT_RETENTION });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Only admins can change retention' }, { status: 403 });

  let body: Partial<retentionService.RetentionSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  for (const field of ['attemptAnswersDays', 'emailLogDays', 'bannerStatsDays'] as const) {
    const v = body[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 3650) {
      return NextResponse.json({ error: `${field} must be a number from 0 to 3650 (0 = never delete)` }, { status: 400 });
    }
    if (v !== 0 && v < 1) {
      return NextResponse.json({ error: `${field} must be at least 1 day (or 0 to never delete)` }, { status: 400 });
    }
  }

  const saved = await retentionService.setRetentionSettings({
    attemptAnswersDays: body.attemptAnswersDays as number,
    emailLogDays: body.emailLogDays as number,
    bannerStatsDays: body.bannerStatsDays as number,
  });
  return NextResponse.json({ settings: saved });
}
