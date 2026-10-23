import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizPurchaseService, quizService, studyAttemptService, userService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Study Mode is the one place the client is allowed to receive the
 * correct answer up front, since the entire point of the mode is
 * immediate answer/explanation reveal per question rather than end-of-quiz
 * grading. Gated on the quiz actually being mode='study' server-side, so
 * a quiz/exam-mode quiz's answers can't be fetched through this route.
 *
 * Private quizzes additionally require the caller to supply the current
 * valid share slug as a query param - this prevents someone who merely
 * knows/guesses a private quiz's internal ID from reading its answers by
 * bypassing the link-expiry system that governs private access everywhere
 * else in the app. Paid quizzes require a completed purchase, same as
 * the regular quiz-question endpoint.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to study this quiz' }, { status: 401 });
  }

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (quiz.mode !== 'study' && quiz.mode !== 'combined') {
    return NextResponse.json({ error: 'This quiz is not in Study Mode' }, { status: 400 });
  }

  if (quiz.visibility === 'private') {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const resolved = slug ? await quizService.getQuizByShareSlug(slug) : null;
    if (!resolved || resolved.id !== quiz.id) {
      return NextResponse.json(
        { error: 'This link is invalid or has expired.' },
        { status: 403 }
      );
    }
    if (resolved.accessMode === 'password') {
      const password = searchParams.get('password');
      const valid = password ? await quizService.checkQuizPassword(quiz.id, password) : false;
      if (!valid) {
        return NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 });
      }
    }
  }

  if (quiz.pricing === 'paid' && !isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    const purchased = await quizPurchaseService.hasUserPurchased(quizId, user.id);
    if (!purchased) {
      return NextResponse.json(
        { error: 'This is a paid quiz. Purchase it to unlock the questions.', requiresPurchase: true, quiz },
        { status: 402 }
      );
    }
  }

  const questions = await quizService.getQuizQuestions(quizId);
  return NextResponse.json({ quiz, questions }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Records one completed Study Mode session (the user reached the
 * "Finish studying" summary screen). This is intentionally separate
 * from quiz_attempts - no score, no leaderboard, no retake policy -
 * see study_attempts / studyAttemptService for why. Fire-and-forget
 * from the client once StudyModeRunner shows its summary screen.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to record study attempts' }, { status: 401 });
  }

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (quiz.mode !== 'study' && quiz.mode !== 'combined') {
    return NextResponse.json({ error: 'This quiz is not in Study Mode' }, { status: 400 });
  }

  await studyAttemptService.recordStudyAttempt(quizId, user.id);

  // Same streak signal quiz/flashcard attempts use - a finished study
  // session is genuine practice too.
  await userService.recordActivityForStreak(user.id);

  return NextResponse.json({ success: true });
}
