import { NextResponse } from 'next/server';
import { featureFlagService, guestService, rateLimitService } from '@/lib/db';
import { getClientIp } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

/** Anonymous +1 when a guest finishes a flashcard run. Nothing else is stored. */
export async function POST(request: Request, { params }: RouteParams) {
  if (!(await featureFlagService.isFeatureEnabled('guest_practice'))) {
    return NextResponse.json({ error: 'Guest Practice is currently unavailable.' }, { status: 404 });
  }
  const { setId } = await params;
  const set = await guestService.getGuestFlashcardSet(setId);
  if (!set) return NextResponse.json({ error: 'This item is not available for guests.' }, { status: 404 });

  const ip = getClientIp(request);
  const gate = await rateLimitService.hit(`guest-done:${setId}:${ip}`, 1, 3600);
  if (gate.allowed) {
    await guestService.recordGuestFlashcardCompletion(setId).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
