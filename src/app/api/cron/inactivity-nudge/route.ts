import { NextResponse } from 'next/server';
import { userService } from '@/lib/db';
import { sendInactivityNudgeEmail } from '@/lib/email/emailService';
import { sendInactivityNudgePush } from '@/lib/push/pushNotificationService';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';
import { getCurrentUser } from '@/lib/auth/currentUser';

/**
 * Sends to users inactive for exactly 3, 7, and 14 days (nudges at a few
 * checkpoints rather than every single day past inactivity).
 */
const NUDGE_DAY_THRESHOLDS = [3, 7, 14];

/**
 * Runs the inactivity-nudge sweep. Shared by the external-cron POST
 * handler below and the admin "Run now" button on /admin/notifications
 * (src/app/api/admin/inactivity-nudge/run/route.ts), so both paths share
 * the exact same chunked-concurrency behavior.
 */
export async function runInactivityNudge() {
  // FIX (Vercel Hobby duration budget) — src/app/api/cron/inactivity-nudge/route.ts
  // Same class of bug as daily-quiz-push: runs daily against every
  // inactive user at each threshold, from a single cron-triggered
  // invocation. Was: fully sequential — email send AND push send,
  // one after another, per user, across all 3 thresholds. Now:
  // chunked concurrency within each threshold's user list so this
  // can't silently get cut off partway through by the function's
  // max duration as the inactive-user list grows.
  const CHUNK_SIZE = 25;
  let totalSent = 0;
  for (const days of NUDGE_DAY_THRESHOLDS) {
    const inactiveUsers = await userService.listUsersInactiveForDays(days);
    for (let i = 0; i < inactiveUsers.length; i += CHUNK_SIZE) {
      const chunk = inactiveUsers.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (user) => {
          await Promise.all([
            sendInactivityNudgeEmail(user, days).catch(() => {}),
            sendInactivityNudgePush(user.id, days).catch(() => {}),
          ]);
          totalSent++;
        })
      );
    }
  }

  return { sent: totalSent };
}

/**
 * Called by an external scheduler (Cloudflare Cron Trigger hitting this
 * URL, or any cron service like cron-job.org) rather than a native
 * Workers `scheduled()` handler, since @cloudflare/next-on-pages apps
 * don't expose one directly. Protected by a shared secret header so it
 * can't be triggered by anyone who finds the URL.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runInactivityNudge();
  return NextResponse.json(result);
}

// ADDED: admin manual-trigger path — src/app/api/cron/inactivity-nudge/route.ts
// Lets an admin fire this sweep on demand from the dashboard, auth'd by
// the logged-in admin's own session via getCurrentUser() rather than the
// cron secret. In addition to the POST handler above, not a replacement.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const result = await runInactivityNudge();
  return NextResponse.json(result);
}
