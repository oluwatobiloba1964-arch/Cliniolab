// src/app/api/guest/quizzes/[quizId]/grade/route.ts
import { NextResponse } from 'next/server';
import { attemptService, featureFlagService, guestService, rateLimitService } from '@/lib/db';
import { getClientIp } from '@/lib/security/rateLimit';
import { GUEST_PRACTICE_COOKIE_MAX_AGE, guestPracticeCookieName } from '@/lib/security/guestPracticeCookie';
import type { AttemptSubmission } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Grades a Guest Practice attempt. Nothing about the attempt is stored: no
 * attempt row, no answers, no score. The only write is an anonymous +1 on
 * the quiz's guest completion counter, throttled per visitor so it cannot
 * be inflated by repeated posts.
 */
export async function POST(request: Request, { params }: RouteParams) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ error: 'Guest Practice is currently unavailable.' }, { status: 404 });
  }
  const { quizId } = await params;
  const quiz = await guestService.getGuestQuiz(quizId);
  if (!quiz) return NextResponse.json({ error: 'This item is not available for guests.' }, { status: 404 });
  if (quiz.mode === 'study') {
    return NextResponse.json({ error: 'Study Mode quizzes are not graded.' }, { status: 400 });
  }

  let body: Omit<AttemptSubmission, 'quizId'>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: '"answers" array is required' }, { status: 400 });
  }

  try {
    const result = await attemptService.gradeWithoutSaving({
      quizId,
      questionIds: Array.isArray(body.questionIds) ? body.questionIds : undefined,
      answers: body.answers,
      timeTakenSeconds: body.timeTakenSeconds ?? 0,
    });

    // Count one completion per visitor per quiz per hour at most.
    const ip = getClientIp(request);
    const gate = await rateLimitService.hit(`guest-done:${quizId}:${ip}`, 1, 3600);
    if (gate.allowed) {
      await guestService.recordGuestQuizCompletion(quizId).catch(() => {});
    }

    const response = NextResponse.json({ result });
    // Remember (per browser) that this quiz's answers were already seen, so a
    // later logged-in attempt on it is not saved or ranked.
    const cookieName = guestPracticeCookieName(quizId);
    if (cookieName) {
      response.cookies.set(cookieName, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: GUEST_PRACTICE_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to grade attempt' },
      { status: 500 }
    );
  }
}
