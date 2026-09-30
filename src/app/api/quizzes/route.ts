import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';
import type { QuizInput } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subcategoryId = searchParams.get('subcategoryId');
  const categoryId = searchParams.get('categoryId');
  const mine = searchParams.get('mine');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;
  const pageParam = searchParams.get('page');

  if (mine === 'true') {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const quizzes = await quizService.listQuizzesByCreator(user.id);
    return NextResponse.json({ quizzes });
  }

  if (subcategoryId) {
    if (pageParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 25) || 25));
      const result = await quizService.listQuizzesBySubcategoryPaginated(subcategoryId, page, pageSize);
      return NextResponse.json(result);
    }
    const quizzes = await quizService.listQuizzesBySubcategory(subcategoryId);
    return NextResponse.json({ quizzes });
  }

  if (categoryId) {
    if (pageParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 25) || 25));
      const result = await quizService.listQuizzesByCategoryPaginated(categoryId, page, pageSize);
      return NextResponse.json(result);
    }
    const quizzes = await quizService.listQuizzesByCategory(categoryId, limit);
    return NextResponse.json({ quizzes });
  }

  // Paginated browse mode (used by the /quizzes page) — opt in via ?page=
  if (pageParam) {
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 12) || 12));
    const result = await quizService.listLatestPublicQuizzesPaginated(page, pageSize);
    return NextResponse.json(result);
  }

  const quizzes = await quizService.listLatestPublicQuizzes(limit);
  return NextResponse.json({ quizzes });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateQuizzes(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create quizzes' }, { status: 403 });
  }

  let input: QuizInput;
  try {
    input = (await request.json()) as QuizInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!input.title || !input.subcategoryId || !input.questions?.length) {
    return NextResponse.json(
      { error: 'title, subcategoryId, and at least one question are required' },
      { status: 400 }
    );
  }
  if (input.visibility === 'private' && input.linkExpiry === 'custom' && !input.customExpiryDate) {
    return NextResponse.json(
      { error: 'customExpiryDate is required when linkExpiry is "custom"' },
      { status: 400 }
    );
  }

  if (input.visibility === 'guest') {
    const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: input.pricing });
    if (guestError) return NextResponse.json({ error: guestError }, { status: 403 });
  }

  try {
    const quiz = await quizService.createQuiz(user.id, input);
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create quiz' },
      { status: 500 }
    );
  }
}
