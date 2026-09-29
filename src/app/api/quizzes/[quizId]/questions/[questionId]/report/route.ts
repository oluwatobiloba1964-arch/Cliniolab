import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { quizService, reportService } from '@/lib/db';
import { enforceRateLimit, getClientIp } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ quizId: string; questionId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { quizId, questionId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to flag a question' }, { status: 401 });
  }

  const limited = await enforceRateLimit(
    { name: 'report-user', id: user.id, limit: 20, windowSeconds: 3600 }
  );
  if (limited) return limited;

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!quiz.allowFlagging) {
    return NextResponse.json(
      { error: 'The creator has turned off question flagging for this quiz' },
      { status: 403 }
    );
  }

  // Confirm the question actually belongs to this quiz, so a stray
  // questionId from a different quiz can't be reported through this route.
  const questions = await quizService.getQuizQuestions(quizId);
  if (!questions.some((q) => q.id === questionId)) {
    return NextResponse.json({ error: 'Question not found on this quiz' }, { status: 404 });
  }

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine -- reason is optional.
  }

  if (body.reason && body.reason.length > 500) {
    return NextResponse.json({ error: 'Reason must be 500 characters or fewer' }, { status: 400 });
  }

  try {
    const report = await reportService.reportQuestion(user.id, questionId, body.reason?.trim() || undefined);
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit report' },
      { status: 500 }
    );
  }
}
