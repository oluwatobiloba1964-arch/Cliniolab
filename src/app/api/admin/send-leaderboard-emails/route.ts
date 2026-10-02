import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { leaderboardService, userService } from '@/lib/db';
import { sendLeaderboardRecognitionEmail } from '@/lib/email/emailService';

/**
 * Admin manually triggers this whenever they want to recognize the
 * current top performers (no fixed cadence, per product decision).
 * Body: { scope: 'general' } or { scope: 'category', categoryId, label }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can send leaderboard emails' }, { status: 403 });
  }

  let body: { scope: 'general' | 'category'; categoryId?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const entries =
    body.scope === 'general'
      ? await leaderboardService.getGeneralLeaderboard()
      : body.categoryId
      ? await leaderboardService.getCategoryLeaderboard(body.categoryId)
      : [];

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No leaderboard entries to notify' }, { status: 400 });
  }

  const label = body.label ?? (body.scope === 'general' ? 'Top Quiz Takers' : 'Category Leaders');

  // FIX (Vercel Hobby duration budget) — src/app/api/admin/send-leaderboard-emails/route.ts
  // Was: one user lookup + one email send per entry, fully sequential.
  // Leaderboards are usually small (top N), so lower risk than the
  // newsletter/blog-push broadcasts, but it's the same shape of bug and
  // scales the same way if "top N" ever grows — fixed with the same
  // chunked-concurrency pattern used there for consistency.
  const CHUNK_SIZE = 25;
  let sent = 0;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (entry) => {
        const recipient = await userService.getUserById(entry.userId);
        if (!recipient) return;
        await sendLeaderboardRecognitionEmail(recipient, entry.rank, label).catch(() => {});
        sent++;
      })
    );
  }

  return NextResponse.json({ sent });
}
