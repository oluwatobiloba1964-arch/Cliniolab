// src/app/api/quizzes/[quizId]/attempt/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { guestPracticeCookieName } from '@/lib/security/guestPracticeCookie';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { attemptService, certificateService, featureFlagService, quizService, userService, RetakeNotAllowedError } from '@/lib/db';
import { sendQuizResultEmail, sendCertificateIssuedEmail } from '@/lib/email/emailService';
import type { AttemptSubmission } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to attempt quizzes' }, { status: 401 });
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

  // This browser already practiced this quiz as a guest (saw the graded
  // answers): grade it so they can keep practicing, but save nothing - no
  // attempt row, no leaderboard, no certificate, no result email.
  const cookieName = guestPracticeCookieName(quizId);
  const practicedAsGuest = !!cookieName && (await cookies()).get(cookieName)?.value === '1';
  if (practicedAsGuest) {
    try {
      const graded = await attemptService.gradeWithoutSaving({
        quizId,
        questionIds: Array.isArray(body.questionIds) ? body.questionIds : undefined,
        answers: body.answers,
        timeTakenSeconds: body.timeTakenSeconds ?? 0,
      });
      await userService.recordActivityForStreak(user.id);
      return NextResponse.json({
        result: { ...graded, countedForLeaderboard: false, previouslyPracticedAsGuest: true },
        certificate: null,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to grade attempt' },
        { status: 500 }
      );
    }
  }

  try {
    const result = await attemptService.submitAttempt(user.id, {
      quizId,
      questionIds: Array.isArray(body.questionIds) ? body.questionIds : undefined,
      answers: body.answers,
      timeTakenSeconds: body.timeTakenSeconds ?? 0,
    });

    // Streak counts any genuine practice session, recorded or not -
    // it's about showing up, not about leaderboard-eligible scores.
    await userService.recordActivityForStreak(user.id);

    const certificatesEnabled = await featureFlagService.isFeatureEnabled('certificates');
    let certificate = null;
    if (certificatesEnabled && result.countedForLeaderboard) {
      certificate = await certificateService.issueCertificateIfEligible(
        user.id,
        quizId,
        70,
        result.percentage
      );
      if (certificate) {
        // Fire-and-forget: an email failure shouldn't fail the attempt
        // response the user is waiting on for their result screen.
        sendCertificateIssuedEmail(user, certificate.quizTitle, certificate.id).catch(() => {});
      }
    }

    // Fire-and-forget: an email failure shouldn't fail the attempt
    // response the user is waiting on for their result screen.
    quizService.getQuizById(quizId).then((quiz) => {
      if (quiz) {
        sendQuizResultEmail(user, quiz.title, result.percentage).catch(() => {});
      }
    });

    return NextResponse.json({ result, certificate });
  } catch (err) {
    if (err instanceof RetakeNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit attempt' },
      { status: 500 }
    );
  }
}
