import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { featureFlagService, feedbackService } from '@/lib/db';
import { enforceRateLimit, getClientIp } from '@/lib/security/rateLimit';
import type { FeedbackCategory } from '@/types';

export async function POST(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('feedback_widget');
  if (!enabled) return NextResponse.json({ error: 'Feedback is currently disabled' }, { status: 403 });

  const limited = await enforceRateLimit(
    { name: 'feedback-ip', id: getClientIp(request), limit: 5, windowSeconds: 3600 }
  );
  if (limited) return limited;

  const user = await getCurrentUser(); // optional - anonymous feedback is allowed

  let body: { category: FeedbackCategory; message: string; pageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const feedback = await feedbackService.submitFeedback({
    userId: user?.id,
    category: body.category ?? 'general',
    message: body.message.trim(),
    pageUrl: body.pageUrl,
  });
  return NextResponse.json({ feedback }, { status: 201 });
}
