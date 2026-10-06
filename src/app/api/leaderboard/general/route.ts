// File: src/app/api/leaderboard/general/route.ts
import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

export async function GET(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_general');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getGeneralLeaderboard(limit);

  // Anonymous homepage visitors do not need a Supabase user lookup or a
  // personalized rank. Their leaderboard payload is safe to edge-cache.
  // Signed-in users keep the personalized rank behavior and are never cached.
  const cookie = request.headers.get('cookie') ?? '';
  const hasSupabaseAuthCookie = cookie.includes('sb-') && cookie.includes('auth-token');
  if (!hasSupabaseAuthCookie) {
    return NextResponse.json(
      { enabled: true, entries, currentUserId: null, currentUserRank: null },
      { headers: { 'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  }

  // Only look up the viewer's own rank when they're signed in AND not
  // already visible in the returned top-N - avoids a wasted query when the
  // user is already in the returned list.
  let currentUserRank: number | null = null;
  const user = await getCurrentUser();
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserGeneralRank(user.id);
  }

  return NextResponse.json({
    enabled: true,
    entries,
    currentUserId: user?.id ?? null,
    currentUserRank,
  });
}
