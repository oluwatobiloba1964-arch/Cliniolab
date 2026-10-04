import { NextResponse } from 'next/server';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const setting = await siteSettingsService.getAdSenseSetting();
  return NextResponse.json(setting, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' } });
}
