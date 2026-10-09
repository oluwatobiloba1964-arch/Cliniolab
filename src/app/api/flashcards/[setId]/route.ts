import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { featureFlagService, flashcardPurchaseService, flashcardService } from '@/lib/db';
import type { FlashcardInput } from '@/types';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 403 });

  const { setId } = await params;
  const user = await getCurrentUser();

  const set = await flashcardService.getFlashcardSetByIdWithStats(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  const owner = isOwnerOrStaff(user?.role ?? null, set.creatorId, user?.id ?? null);

  if (set.visibility === 'private' && !owner) {
    return NextResponse.json({ error: 'This flashcard set is private.' }, { status: 403 });
  }

  // Paid sets require a completed purchase, unless owner/staff.
  if (set.pricing === 'paid' && !owner) {
    if (!user) {
      return NextResponse.json(
        { error: 'Login required to unlock this paid flashcard set.', requiresPurchase: true, set },
        { status: 402 }
      );
    }
    const purchased = await flashcardPurchaseService.hasUserPurchased(setId, user.id);
    if (!purchased) {
      return NextResponse.json(
        { error: 'This is a paid flashcard set. Purchase it to unlock the cards.', requiresPurchase: true, set },
        { status: 402 }
      );
    }
  }

  // ?preview=1 skips getFlashcardsBySetId entirely (the query that scales
  // with card count). The client uses this as a cheap freshness check
  // against its localStorage cache: if set.updatedAt still matches what
  // was cached, it reuses the cached cards instead of re-fetching them.
  const { searchParams } = new URL(request.url);
  if (searchParams.get('preview') === '1') {
    return NextResponse.json({ set, cards: [] });
  }

  const cards = await flashcardService.getFlashcardsBySetId(setId);
  return NextResponse.json({ set, cards });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, set.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this flashcard set' }, { status: 403 });
  }

  let input: FlashcardInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!input.title || !input.subcategoryId || !input.cards?.length) {
    return NextResponse.json(
      { error: 'Title, subcategory, and at least one card are required' },
      { status: 400 }
    );
  }

  // Only re-check when the visibility is actually changing to Guest, so an
  // already-Guest set stays editable even if creator access is tightened.
  if (input.visibility === 'guest' && set.visibility !== 'guest') {
    const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: input.pricing });
    if (guestError) return NextResponse.json({ error: guestError }, { status: 403 });
  }
  if (input.visibility === 'guest' && input.pricing === 'paid') {
    return NextResponse.json({ error: 'Paid items cannot be set to Guest. Guest items must be free.' }, { status: 403 });
  }

  try {
    const updated = await flashcardService.updateFlashcardSet(setId, input);
    return NextResponse.json({ set: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update flashcard set' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, set.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to delete this flashcard set' }, { status: 403 });
  }

  try {
    await flashcardService.deleteFlashcardSet(setId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete flashcard set' },
      { status: 500 }
    );
  }
}
