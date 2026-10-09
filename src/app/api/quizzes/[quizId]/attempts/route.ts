// src/app/api/quizzes/[quizId]/attempts/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService, attemptService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Lists everyone who has attempted this quiz, with their score - for the
 * quiz creator's own "who attempted my quiz" view on the dashboard.
 * Works for both private and public quizzes, and is independent of the
 * leaderboard (which is governed by the admin leaderboard_per_quiz flag
 * and the quiz's own leaderboardEnabled toggle). Owner/staff only.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to view attempts for this quiz' }, { status: 403 });
  }

  const attempts = await attemptService.getAttemptsByQuizWithTakers(quizId);
  return NextResponse.json({ attempts });
}
