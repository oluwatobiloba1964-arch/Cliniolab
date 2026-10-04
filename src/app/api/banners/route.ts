import { NextResponse } from 'next/server';
import { bannerService, featureFlagService } from '@/lib/db';
import type { BannerPlacement } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placement = searchParams.get('placement');

  if (placement !== 'header' && placement !== 'footer') {
    return NextResponse.json({ error: 'placement must be "header" or "footer"' }, { status: 400 });
  }

  const flagKey = placement === 'header' ? 'banners_header' : 'banners_footer';
  const enabled = await featureFlagService.isFeatureEnabled(flagKey);
  if (!enabled) {
    return NextResponse.json(
      { enabled: false, banners: [] },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const banners = await bannerService.listActiveBanners(placement as BannerPlacement);
  return NextResponse.json(
    { enabled: true, banners },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
