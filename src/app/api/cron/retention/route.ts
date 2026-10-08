// src/app/api/cron/retention/route.ts
import { NextResponse } from 'next/server';
import { retentionService } from '@/lib/db';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';

/**
 * Data-retention purge (attempt_answers, old email_log, optionally
 * old banner_stats), run on whatever interval the external scheduler is
 * configured for (daily, weekly, etc. — not fixed by this route). Windows
 * come from the admin "Storage" page, so changing them never needs a
 * redeploy. Same auth as the other cron routes: an external scheduler
 * POSTs with the shared x-cron-secret header.
 *
 * Idempotent and resumable: if a run hits its batch ceiling, `complete` is
 * false and the next run simply continues where this one stopped.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await retentionService.runRetention();
  return NextResponse.json(result);
}
