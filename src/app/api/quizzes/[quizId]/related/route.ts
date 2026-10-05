import { NextResponse } from 'next/server';
import { categoryService, cmsService, flashcardService, quizService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;

  const setting = await siteSettingsService.getRelatedQuizzesQuizPageSetting();
  if (!setting.enabled) {
    return NextResponse.json(
      { quizzes: [], flashcards: [], posts: [] },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const subcategory = await categoryService.getSubcategoryById(quiz.subcategoryId);
  const [quizzes, flashcards, posts] = await Promise.all([
    quizService.listRelatedQuizzes(quiz.subcategoryId, quizId, Math.min(setting.count, 6)),
    flashcardService.listFlashcardSetsBySubcategory(quiz.subcategoryId, 6),
    subcategory
      ? cmsService.getPostsByCategory(subcategory.name, 3)
      : Promise.resolve([]),
  ]);

  return NextResponse.json(
    {
      quizzes,
      flashcards,
      posts: posts.slice(0, 3),
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
