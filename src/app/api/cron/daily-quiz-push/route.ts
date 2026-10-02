import { NextResponse } from 'next/server';
import { dailyQuizService, featureFlagService } from '@/lib/db';
import { listSubscribedUserIds } from '@/lib/db/services/pushSubscriptionService';
import { sendDailyQuizPush } from '@/lib/push/pushNotificationService';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';
import { getCurrentUser } from '@/lib/auth/currentUser';

/**
 * Broadcasts the daily quiz reminder to every subscribed user. Shared by
 * the external-cron POST handler below and the admin "Run now" button on
 * /admin/notifications (src/app/api/admin/daily-quiz-push/run/route.ts),
 * so both paths get the exact same chunked-concurrency behavior and
 * neither can drift out of sync with the other.
 *
 * Uses the same dailyQuizService pick as the homepage banner, so the push
 * always points at the quiz the banner shows. Users who already took
 * today's quiz are skipped (admin-configurable).
 */
export async function runDailyQuizPush() {
  const dailyQuizEnabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!dailyQuizEnabled) return { sent: 0, skipped: 0, reason: 'daily_quiz feature disabled' };

  const quiz = await dailyQuizService.getTodaysDailyQuiz();
  if (!quiz) return { sent: 0, skipped: 0, reason: 'no quizzes available' };

  const settings = await dailyQuizService.getSettings();
  const userIds = await listSubscribedUserIds();

  // FIX (Vercel Hobby duration budget) — src/app/api/cron/daily-quiz-push/route.ts
  // This one matters most of all the broadcast loops: it runs once a
  // day, every day, against the ENTIRE subscribed-user list, from an
  // external scheduler hitting this route as a single HTTP request/
  // single function invocation. Was: fully sequential — one DB check
  // (hasUserCompletedQuiz) plus one push send per user, one after
  // another. On any non-trivial subscriber count this was already
  // likely to exceed Hobby's function duration limit and get killed
  // partway through the list every single day.
  // Now: chunked concurrency (CHUNK_SIZE users at a time) instead of
  // one at a time. Not all at once, since thousands of simultaneous
  // outbound push requests plus DB checks in one invocation risks
  // exhausting connections in its own right.
  const CHUNK_SIZE = 25;
  let sent = 0;
  let skipped = 0;
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (userId) => {
        if (settings.skipCompletedForPush && (await dailyQuizService.hasUserCompletedQuiz(userId, quiz.id))) {
          skipped++;
          return;
        }
        await sendDailyQuizPush(userId, quiz.title, `/quizzes/${quiz.id}`).catch(() => {});
        sent++;
      })
    );
  }

  return { sent, skipped, quizId: quiz.id };
}

/**
 * Call this from any external scheduler (e.g. a cron-job.org job hitting
 * this URL once a day) with header `x-cron-secret: <secret>`. The secret
 * can be set from the admin Notifications settings page at any time, or
 * via the CRON_SECRET env var as a fallback.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDailyQuizPush();
  return NextResponse.json(result);
}

// ADDED: admin manual-trigger path — src/app/api/cron/daily-quiz-push/route.ts
// Lets an admin fire this broadcast on demand from the dashboard (e.g. to
// test it, or to send today's reminder a second time after fixing a
// misconfigured quiz) without needing the cron secret, auth'd instead by
// the logged-in admin's own session via getCurrentUser(). This is in
// addition to the POST handler above, not a replacement — the external
// scheduler keeps using x-cron-secret exactly as before.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const result = await runDailyQuizPush();
  return NextResponse.json(result);
}
