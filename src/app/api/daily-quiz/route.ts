import { NextResponse } from 'next/server';
import { dailyQuizService, featureFlagService } from '@/lib/db';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!enabled) {
    return NextResponse.json(
      { enabled: false, quiz: null },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const quiz = await dailyQuizService.getTodaysDailyQuiz();
  return NextResponse.json(
    { enabled: true, quiz },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
