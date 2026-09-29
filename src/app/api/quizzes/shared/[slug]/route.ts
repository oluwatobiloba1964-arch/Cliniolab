import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { quizService } from '@/lib/db';
import { enforceRateLimit, getClientIp } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to view this quiz' }, { status: 401 });
  }

  const quiz = await quizService.getQuizByShareSlug(slug);
  if (!quiz) {
    return NextResponse.json({ error: 'This link is invalid or has expired' }, { status: 404 });
  }

  if (quiz.accessMode === 'password') {
    const password = new URL(request.url).searchParams.get('password');
    if (!password) {
      // Tell the client a password is needed without leaking any quiz
      // content yet.
      return NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 });
    }
    // Brute-force guard: every password attempt counts, per user and per IP.
    const limited = await enforceRateLimit(
      { name: 'quiz-pw-user', id: `${user.id}:${slug}`, limit: 8, windowSeconds: 600 },
      { name: 'quiz-pw-ip', id: `${getClientIp(request)}:${slug}`, limit: 20, windowSeconds: 600 }
    );
    if (limited) return limited;
    const valid = await quizService.checkQuizPassword(quiz.id, password);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password', passwordRequired: true }, { status: 401 });
    }
  }

  const questions = await quizService.getQuizQuestions(quiz.id);
  const safeQuestions = questions.map(({ correctAnswer: _correctAnswer, ...rest }) => rest);

  return NextResponse.json({ quiz, questions: safeQuestions });
}
