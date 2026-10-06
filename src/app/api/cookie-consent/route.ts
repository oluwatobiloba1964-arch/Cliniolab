// File: src/app/api/cookie-consent/route.ts
import { NextResponse } from 'next/server';

const CC = 'public, max-age=300, s-maxage=300, stale-while-revalidate=600';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const setting = await siteSettingsService.getCookieConsentSetting();
  return NextResponse.json({ setting }, { headers: { 'Cache-Control': CC } });
}
