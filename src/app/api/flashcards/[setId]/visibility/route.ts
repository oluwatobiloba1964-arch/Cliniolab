// src/app/api/flashcards/[setId]/visibility/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { flashcardService } from '@/lib/db';
import type { QuizVisibility } from '@/types';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

interface VisibilityBody {
  visibility?: QuizVisibility;
}

/**
 * Dedicated visibility switch used by the dashboard buttons
 * (Make private / Make public / Move to Guest) - mirrors
 * /api/quizzes/[quizId]/visibility. Only touches visibility - never
 * requires title/subcategory/cards like the general PATCH route does.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, set.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this flashcard set' }, { status: 403 });
  }

  let body: VisibilityBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const visibility = body.visibility;
  if (visibility !== 'public' && visibility !== 'private' && visibility !== 'guest') {
    return NextResponse.json(
      { error: 'visibility must be "public", "private" or "guest"' },
      { status: 400 }
    );
  }

  if (visibility === 'guest' && set.pricing === 'paid') {
    return NextResponse.json(
      { error: 'Paid flashcard sets cannot be moved to Guest Practice. Make it free first.' },
      { status: 400 }
    );
  }

  if (visibility === 'guest' && set.visibility !== 'guest') {
    const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: set.pricing });
    if (guestError) return NextResponse.json({ error: guestError }, { status: 403 });
  }

  try {
    await flashcardService.setFlashcardSetVisibility(setId, visibility);
    const updated = await flashcardService.getFlashcardSetById(setId);
    return NextResponse.json({ set: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update visibility' },
      { status: 500 }
    );
  }
}
