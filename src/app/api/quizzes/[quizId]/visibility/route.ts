import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { attemptService, quizPurchaseService, quizService } from '@/lib/db';
import type { QuizInput } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to view quiz questions' }, { status: 401 });
  }

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  // Private quizzes are only reachable through /api/quizzes/shared/[slug],
  // which enforces the share-link expiry. Fetching by raw ID here would
  // otherwise bypass that entirely for anyone who knows/guesses the ID.
  if (quiz.visibility === 'private' && !isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json(
      { error: 'This quiz is private. Use its share link to access it.' },
      { status: 403 }
    );
  }

  // Paid quizzes require a completed purchase, unless the requester is
  // the creator themselves or staff previewing/moderating it.
  if (quiz.pricing === 'paid' && !isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    const purchased = await quizPurchaseService.hasUserPurchased(quizId, user.id);
    if (!purchased) {
      return NextResponse.json(
        { error: 'This is a paid quiz. Purchase it to unlock the questions.', requiresPurchase: true, quiz },
        { status: 402 }
      );
    }
  }

  let questions = await quizService.getQuizQuestions(quizId);
  const isOwnerOrModerator = isOwnerOrStaff(user.role, quiz.creatorId, user.id);

  // ?missedOnly=1 narrows the question set down to whatever the user got
  // wrong on their most recent recorded attempt of this quiz, derived
  // entirely from quiz_attempts/attempt_answers - no separate "missed
  // questions" storage. If they have no recorded attempt (or missed
  // nothing), this returns the full set unchanged so "Retake missed" never
  // produces a confusing empty quiz.
  const { searchParams } = new URL(request.url);
  if (searchParams.get('missedOnly') === '1') {
    const missedIds = new Set(await attemptService.getMissedQuestionIds(quizId, user.id));
    if (missedIds.size > 0) {
      questions = questions.filter((q) => missedIds.has(q.id));
    }
  }

  // Strip correct answers before sending to the client during attempts;
  // they're only needed at grading time (handled server-side in /attempt).
  // Exception: the creator (or staff) editing their own quiz needs the
  // real answers back to pre-fill the edit form.
  const safeQuestions = isOwnerOrModerator
    ? questions
    : questions.map(({ correctAnswer: _correctAnswer, ...rest }) => rest);

  // Whether this user has ever recorded an attempt on this quiz before -
  // used client-side to gate the copy-block anti-cheat overlay to only a
  // user's genuine first attempt, regardless of the quiz's own retake or
  // anti-cheat settings. The owner/moderator previewing their own quiz
  // isn't "attempting" it, so it's not meaningful to block copying for
  // them.
  const hasAttempted = isOwnerOrModerator ? false : await attemptService.hasUserAttemptedQuiz(quizId, user.id);

  return NextResponse.json({ quiz, questions: safeQuestions, hasAttempted });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this quiz' }, { status: 403 });
  }

  let input: QuizInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!input.title || !input.subcategoryId || !input.questions?.length) {
    return NextResponse.json(
      { error: 'Title, subcategory, and at least one question are required' },
      { status: 400 }
    );
  }
  if (input.mode === 'exam' && !input.timeLimitSeconds) {
    return NextResponse.json(
      { error: 'Exam mode requires a time limit' },
      { status: 400 }
    );
  }

  // A Guest Practice quiz must stay free.
  if (quiz.visibility === 'guest' && input.pricing === 'paid') {
    return NextResponse.json(
      { error: 'Guest Practice quizzes must be free. Change visibility first to make it paid.' },
      { status: 400 }
    );
  }

  try {
    let updated = await quizService.updateQuiz(quizId, input);

    // updateQuiz() deliberately never touches `visibility` (it preserves
    // whatever share slug/expiry is already set rather than resetting it
    // on every unrelated edit). So if the form's visibility differs from
    // what's stored, apply that change explicitly here — otherwise a
    // visibility switch made from the edit form (as opposed to the
    // dashboard's "Regenerate link" action) was silently dropped.
    if (input.visibility && input.visibility !== quiz.visibility) {
      await quizService.setQuizVisibility(
        quizId,
        input.visibility,
        input.linkExpiry,
        input.customExpiryDate
      );
      updated = await quizService.getQuizById(quizId) ?? updated;
    }

    return NextResponse.json({ quiz: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update quiz' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to delete this quiz' }, { status: 403 });
  }

  try {
    await quizService.deleteQuiz(quizId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete quiz' },
      { status: 500 }
    );
  }
}
