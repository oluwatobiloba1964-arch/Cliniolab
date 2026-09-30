import { NextResponse } from 'next/server';
import { featureFlagService, guestService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

/** Guest Practice flashcard set. No login. Only published, free, 'guest' sets. */
export async function GET(_request: Request, { params }: RouteParams) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ error: 'Guest Practice is currently unavailable.' }, { status: 404 });
  }
  if (!(await featureFlagService.isFeatureEnabled('flashcards'))) {
    return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 404 });
  }
  const { setId } = await params;
  const set = await guestService.getGuestFlashcardSet(setId);
  if (!set) return NextResponse.json({ error: 'This item is not available for guests.' }, { status: 404 });
  const cards = await guestService.getGuestFlashcards(setId);
  return NextResponse.json({ set: { ...set, creatorId: '' }, cards });
}
