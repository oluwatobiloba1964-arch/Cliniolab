import { NextResponse } from 'next/server';
import { featureFlagService, guestService } from '@/lib/db';
import type { GuestItemKind } from '@/lib/db/services/guestService';

/** Public list of Guest Practice items (homepage carousel and /guest hub). */
export async function GET(request: Request) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ enabled: false, items: [], total: 0 });
  }
  const flashcardsOn = await featureFlagService.isFeatureEnabled('flashcards');

  const { searchParams } = new URL(request.url);
  const limit = Math.min(60, Math.max(1, Number(searchParams.get('limit') ?? 15) || 15));
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);
  const kindParam = searchParams.get('kind');
  const kind: GuestItemKind | undefined =
    kindParam === 'quiz' || kindParam === 'study' || kindParam === 'flashcards' ? kindParam : undefined;

  if (kind === 'flashcards' && !flashcardsOn) {
    return NextResponse.json({ enabled: true, items: [], total: 0 });
  }

  const [items, total] = await Promise.all([
    guestService.listGuestItems({ limit, offset, kind }),
    guestService.countGuestItems(),
  ]);
  const visible = flashcardsOn ? items : items.filter((i) => i.kind !== 'flashcards');
  return NextResponse.json(
    { enabled: true, items: visible, total },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
  );
}
