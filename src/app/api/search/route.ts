import { NextResponse } from 'next/server';
import { featureFlagService, searchService } from '@/lib/db';

export async function GET(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('site_search');
  if (!enabled) return NextResponse.json({ enabled: false, results: null }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' } });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ enabled: true, results: { quizzes: [], posts: [], resources: [] } }, { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=60' } });
  }

  const results = await searchService.searchSite(query);
  return NextResponse.json({ enabled: true, results }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' } });
}
