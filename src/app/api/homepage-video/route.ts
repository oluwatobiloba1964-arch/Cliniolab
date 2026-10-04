import { NextResponse } from 'next/server';
import { featureFlagService, siteSettingsService } from '@/lib/db';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('homepage_video');
  if (!enabled) {
    return NextResponse.json(
      { enabled: false, video: null },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const video = await siteSettingsService.getHomepageVideo();
  return NextResponse.json(
    { enabled: true, video },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
