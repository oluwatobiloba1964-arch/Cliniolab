// File: src/app/api/clinical-practice/today/route.ts
import { NextResponse } from 'next/server';
import { clinicalPracticeService } from '@/lib/db';

/**
 * Today's Clinical Practice set (5 cases, 5 calculations, 3 OSCE
 * stations), picked deterministically from the item bank - same result
 * for every caller on a given Africa/Lagos day, nothing written. Cached
 * at the edge for the day and again in the browser (see
 * LocalClinicalPractice.tsx), so this query runs at most once per
 * visitor per day.
 */
export async function GET() {
  const set = await clinicalPracticeService.getTodaysPracticeSet();
  return NextResponse.json(set, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
