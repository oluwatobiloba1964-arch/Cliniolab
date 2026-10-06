// File: src/app/api/leaderboard/quiz/[quizId]/route.ts
import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService, quizService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

const CC = 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_per_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  // Private quizzes let their creator turn the leaderboard off for that
  // one quiz. Only ever narrows visibility beyond the global admin flag.
  const quiz = await quizService.getQuizById(quizId);
  if (quiz?.visibility === 'private' && !quiz.leaderboardEnabled) {
    return NextResponse.json({ enabled: false, entries: [] });
  }

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getQuizLeaderboard(quizId, limit);

  // Anonymous visitors get the same list, so it can be edge-cached.
  const cookie = request.headers.get('cookie') ?? '';
  const hasSupabaseAuthCookie = cookie.includes('sb-') && cookie.includes('auth-token');
  if (!hasSupabaseAuthCookie) {
    return NextResponse.json(
      { enabled: true, entries, currentUserId: null, currentUserRank: null },
      { headers: { 'Cache-Control': CC, Vary: 'Cookie' } }
    );
  }

  let currentUserRank: number | null = null;
  const user = await getCurrentUser();
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserQuizRank(quizId, user.id);
  }

  return NextResponse.json(
    {
      enabled: true,
      entries,
      currentUserId: user?.id ?? null,
      currentUserRank,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
