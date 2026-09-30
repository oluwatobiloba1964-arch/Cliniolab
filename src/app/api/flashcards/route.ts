import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { featureFlagService, flashcardService } from '@/lib/db';
import type { FlashcardInput } from '@/types';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';

export async function GET(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) return NextResponse.json({ enabled: false, sets: [] });

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
    const sets = await flashcardService.listFlashcardSetsByCreator(user.id);
    return NextResponse.json({ enabled: true, sets });
  }

  if (subcategoryId) {
    const sets = await flashcardService.listFlashcardSetsBySubcategory(subcategoryId);
    return NextResponse.json({ enabled: true, sets });
  }

  if (categoryId) {
    if (pageParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 25) || 25));
      const result = await flashcardService.listFlashcardSetsByCategoryPaginated(categoryId, page, pageSize);
      return NextResponse.json({ enabled: true, ...result });
    }
    const sets = await flashcardService.listFlashcardSetsByCategory(categoryId, limit);
    return NextResponse.json({ enabled: true, sets });
  }

  if (pageParam) {
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 12) || 12));
    const result = await flashcardService.listLatestPublicFlashcardSetsPaginated(page, pageSize);
    return NextResponse.json({ enabled: true, ...result });
  }

  const sets = await flashcardService.listLatestPublicFlashcardSets(limit);
  return NextResponse.json({ enabled: true, sets });
}

export async function POST(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateFlashcards(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create flashcards' }, { status: 403 });
  }

  let input: FlashcardInput;
  try {
    input = (await request.json()) as FlashcardInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!input.title || !input.subcategoryId || !input.cards?.length) {
    return NextResponse.json(
      { error: 'title, subcategoryId, and at least one card are required' },
      { status: 400 }
    );
  }
  for (const card of input.cards) {
    if (!card.front?.trim() || !card.back?.trim()) {
      return NextResponse.json({ error: 'Each card needs a front and a back' }, { status: 400 });
    }
  }
  if (input.pricing === 'paid' && (!input.priceKobo || input.priceKobo <= 0)) {
    return NextResponse.json({ error: 'priceKobo is required for a paid flashcard set' }, { status: 400 });
  }

  if (input.visibility === 'guest') {
    const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: input.pricing });
    if (guestError) return NextResponse.json({ error: guestError }, { status: 403 });
  }

  try {
    const set = await flashcardService.createFlashcardSet(user.id, input);
    return NextResponse.json({ set }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create flashcard set' },
      { status: 500 }
    );
  }
}
