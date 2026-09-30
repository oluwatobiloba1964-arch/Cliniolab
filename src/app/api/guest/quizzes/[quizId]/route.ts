import { NextResponse } from 'next/server';
import { featureFlagService, guestService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Guest Practice quiz payload. No login required. Only published, free
 * quizzes with visibility 'guest' are served. Correct answers and the
 * "why the others are wrong" notes are only sent for Study Mode quizzes,
 * where revealing them immediately is the point; for quiz/exam mode they
 * come back from the grading endpoint after submit.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ error: 'Guest Practice is currently unavailable.' }, { status: 404 });
  }
  const { quizId } = await params;
  const quiz = await guestService.getGuestQuiz(quizId);
  if (!quiz) return NextResponse.json({ error: 'This item is not available for guests.' }, { status: 404 });

  const questions = await guestService.getGuestQuizQuestions(quizId);
  const safeQuestions =
    quiz.mode === 'study'
      ? questions
      : questions.map(({ correctAnswer: _c, incorrectRationale: _r, explanation: _e, ...rest }) => ({
          ...rest,
          explanation: null,
        }));

  // Never expose creator/share internals to anonymous visitors.
  const publicQuiz = { ...quiz, shareSlug: null, linkExpiresAt: null, hasPassword: false, creatorId: '' };
  return NextResponse.json({ quiz: publicQuiz, questions: safeQuestions });
}
