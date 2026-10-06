// File: src/app/api/creators/[userId]/route.ts
import { NextResponse } from 'next/server';

const CC = 'public, max-age=300, s-maxage=300, stale-while-revalidate=600';
import { flashcardService, quizService, userService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * Public creator profile data - deliberately no auth check, since this
 * is what /creator/[userId] and shared quiz links point at. Only
 * returns the narrow public projection from getPublicCreatorProfile
 * (no email, payout info, streaks) plus their public quizzes and
 * aggregate attempt counts across those quizzes.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { userId } = await params;

  const profile = await userService.getPublicCreatorProfile(userId);
  if (!profile) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const quizzes = await quizService.listPublicQuizzesByCreator(userId);

  // Aggregate across every public quiz this creator has - "students
  // reached" in the sense QuizzerWeb-style profile cards use it: anyone
  // who finished a graded attempt or a study session counts, since both
  // represent someone actually engaging with the creator's content.
  const quizAttempts = quizzes.reduce(
    (sum, q) => sum + q.attemptCount + (q.studyAttemptCount ?? 0),
    0
  );

  // Flashcard sets count toward reach too - a completed flashcard study
  // session is a student engaging with the creator's content. Failure
  // here must not break the profile, so fall back to zeros.
  const flashcardStats = await flashcardService
    .getPublicFlashcardStatsByCreator(userId)
    .catch(() => ({ setCount: 0, totalAttempts: 0 }));
  const totalAttempts = quizAttempts + flashcardStats.totalAttempts;

  return NextResponse.json(
    {
      profile,
      quizzes,
      stats: {
        quizCount: quizzes.length,
        flashcardSetCount: flashcardStats.setCount,
        totalAttempts,
      },
    },
    { headers: { 'Cache-Control': CC } }
  );
}
