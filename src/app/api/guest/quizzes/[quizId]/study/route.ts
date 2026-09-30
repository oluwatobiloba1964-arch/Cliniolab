import { NextResponse } from 'next/server';
import { featureFlagService, guestService, rateLimitService } from '@/lib/db';
import { getClientIp } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/** Anonymous +1 when a guest finishes a Study Mode pass. Nothing else is stored. */
export async function POST(request: Request, { params }: RouteParams) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ error: 'Guest Practice is currently unavailable.' }, { status: 404 });
  }
  const { quizId } = await params;
  const quiz = await guestService.getGuestQuiz(quizId);
  if (!quiz) return NextResponse.json({ error: 'This item is not available for guests.' }, { status: 404 });
  if (quiz.mode !== 'study') return NextResponse.json({ error: 'Not a Study Mode quiz.' }, { status: 400 });

  const ip = getClientIp(request);
  const gate = await rateLimitService.hit(`guest-done:${quizId}:${ip}`, 1, 3600);
  if (gate.allowed) {
    await guestService.recordGuestStudyCompletion(quizId).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
