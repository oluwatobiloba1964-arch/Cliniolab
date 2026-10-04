import { NextResponse } from 'next/server';
import { scholarService } from '@/lib/db';

export async function GET() {
  const scholar = await scholarService.getActiveScholar();
  return NextResponse.json(
    { scholar },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' } }
  );
}
