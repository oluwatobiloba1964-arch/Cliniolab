// src/app/api/flashcards/[setId]/attempts/list/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { flashcardAttemptService, flashcardService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

/**
 * Lists everyone who has completed this flashcard set - for the creator's
 * own "who attempted my set" view on the dashboard. Mirrors
 * GET /api/quizzes/[quizId]/attempts. Owner/staff only.
 *
 * Kept at .../attempts/list rather than GET on .../attempts itself,
 * since that path's POST already records attempts for any logged-in
 * study session and a same-path owner-only GET would be easy to confuse
 * with it.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, set.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to view attempts for this flashcard set' }, { status: 403 });
  }

  const attempts = await flashcardAttemptService.getAttemptsBySetWithTakers(setId);
  return NextResponse.json({ attempts });
}
