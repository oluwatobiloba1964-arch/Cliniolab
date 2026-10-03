// src/app/api/quizzes/[quizId]/visibility/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { LinkExpiryOption, QuizAccessMode, QuizVisibility } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

interface VisibilityBody {
  visibility?: QuizVisibility;
  accessMode?: QuizAccessMode;
  password?: string;
  linkExpiry?: LinkExpiryOption;
  customExpiryDate?: string;
}

/**
 * Dedicated visibility switch used by the dashboard buttons
 * (Make private / Make public / Move to Guest).
 * Only touches visibility - never requires title/subcategory/questions.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this quiz' }, { status: 403 });
  }

  let body: VisibilityBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const visibility = body.visibility;
  if (visibility !== 'public' && visibility !== 'private' && visibility !== 'guest') {
    return NextResponse.json(
      { error: 'visibility must be "public", "private" or "guest"' },
      { status: 400 }
    );
  }

  // A Guest Practice quiz must stay free.
  if (visibility === 'guest' && quiz.pricing === 'paid') {
    return NextResponse.json(
      { error: 'Paid quizzes cannot be moved to Guest Practice. Make it free first.' },
      { status: 400 }
    );
  }

  const accessMode: QuizAccessMode = body.accessMode === 'password' ? 'password' : 'link';
  if (visibility === 'private' && accessMode === 'password') {
    if (!body.password || body.password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
  }
  if (visibility === 'private' && accessMode === 'link' && body.linkExpiry === 'custom' && !body.customExpiryDate) {
    return NextResponse.json({ error: 'Pick a custom expiry date for the private link' }, { status: 400 });
  }

  try {
    await quizService.setQuizVisibility(
      quizId,
      visibility,
      body.linkExpiry,
      body.customExpiryDate,
      accessMode,
      body.password
    );
    const updated = await quizService.getQuizById(quizId);
    return NextResponse.json({ quiz: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update visibility' },
      { status: 500 }
    );
  }
}
