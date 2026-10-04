import { NextResponse } from 'next/server';
import { featureFlagService } from '@/lib/db';
import type { FeatureFlagKey } from '@/types';

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { key } = await params;
  const flag = await featureFlagService.getFeatureFlag(key as FeatureFlagKey);
  return NextResponse.json(
    { enabled: flag.enabled, label: flag.label },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
