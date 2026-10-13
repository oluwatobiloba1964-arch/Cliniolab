// src/app/api/flashcards/bulk/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { featureFlagService, flashcardService } from '@/lib/db';
import type { FlashcardInput } from '@/types';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';

/**
 * Accepts { sets: FlashcardInput[] } and creates them all in one request.
 *
 * Previously the bulk-upload page had no server-side bulk endpoint at all -
 * it looped client-side, POSTing to /api/flashcards once per set. For a
 * real upload (dozens of sets) that's dozens of separate round trips from
 * the browser, with no all-or-nothing guarantee if the connection drops or
 * the tab closes partway through. This mirrors /api/quizzes/bulk: validate
 * everything up front, then create every set server-side, concurrently
 * (see flashcardService.bulkCreateFlashcardSets), rolling back anything
 * this call created if any one set fails.
 */
export async function POST(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateFlashcards(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create flashcards' }, { status: 403 });
  }

  let body: { sets: FlashcardInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.sets) || body.sets.length === 0) {
    return NextResponse.json({ error: '"sets" must be a non-empty array' }, { status: 400 });
  }

  for (const [index, set] of body.sets.entries()) {
    if (!set.title?.trim() || !set.subcategoryId || !Array.isArray(set.cards) || set.cards.length === 0) {
      return NextResponse.json(
        { error: `Set at index ${index} is missing title, subcategoryId, or cards` },
        { status: 400 }
      );
    }
    if (!['public', 'private', 'guest'].includes(set.visibility)) {
      return NextResponse.json({ error: `Set at index ${index} has an invalid visibility` }, { status: 400 });
    }
    if (set.pricing !== undefined && set.pricing !== 'free' && set.pricing !== 'paid') {
      return NextResponse.json({ error: `Set at index ${index} has an invalid pricing` }, { status: 400 });
    }
    if (set.pricing === 'paid' && (!Number.isFinite(set.priceKobo ?? NaN) || (set.priceKobo ?? 0) <= 0)) {
      return NextResponse.json(
        { error: `Set at index ${index}: a paid set requires a positive priceKobo` },
        { status: 400 }
      );
    }
    for (const [cardIndex, card] of set.cards.entries()) {
      if (!card.front?.trim() || !card.back?.trim()) {
        return NextResponse.json(
          { error: `Set at index ${index}, card ${cardIndex + 1} needs a front and a back` },
          { status: 400 }
        );
      }
    }
  }

  // Run concurrently rather than one at a time in a for-loop - same reason
  // as the quiz bulk route: N sequential DB round trips just for this
  // validation pass is exactly the kind of thing that pushes a large bulk
  // upload past Vercel's function duration budget before any insert work
  // even starts.
  const guestChecks = await Promise.all(
    body.sets.map(async (set, index) => {
      if (set.visibility !== 'guest') return null;
      const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: set.pricing });
      return guestError ? { index, guestError } : null;
    })
  );
  const firstGuestFailure = guestChecks.find((r) => r !== null);
  if (firstGuestFailure) {
    return NextResponse.json(
      { error: `Set at index ${firstGuestFailure.index}: ${firstGuestFailure.guestError}` },
      { status: 403 }
    );
  }

  try {
    const created = await flashcardService.bulkCreateFlashcardSets(user.id, body.sets);
    return NextResponse.json({ sets: created }, { status: 201 });
  } catch (err) {
    console.error('Bulk flashcard upload failed:', err);
    return NextResponse.json(
      { error: 'Something went wrong while publishing these flashcard sets. Nothing was saved - please try again, and contact support if it keeps happening.' },
      { status: 500 }
    );
  }
}
