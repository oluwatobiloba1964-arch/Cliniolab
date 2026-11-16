import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_category');
  if (!enabled) {
    return NextResponse.json(
      { enabled: false, entries: [] },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const user = await getCurrentUser();
  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getCategoryLeaderboard(categoryId, limit);

  let currentUserRank: number | null = null;
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserCategoryRank(categoryId, user.id);
  }

  // Anonymous visitors all get the same payload (currentUserId null), so it
  // can live on the edge; logged-in responses embed a user id and rank and
  // must stay private.
  const cacheControl = user
    ? 'private, no-store'
    : 'public, max-age=30, s-maxage=300, stale-while-revalidate=600';

  return NextResponse.json(
    {
      enabled: true,
      entries,
      currentUserId: user?.id ?? null,
      currentUserRank,
    },
    { headers: { 'Cache-Control': cacheControl } }
  );
}
