import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import {
  certificateService,
  featureFlagService,
  flashcardService,
  quizService,
  reportService,
  userService,
} from '@/lib/db';

/**
 * Authenticated dashboard payload. Keeping the dashboard reads in one request
 * avoids four separate Worker/Vercel invocations on every dashboard visit.
 * The underlying D1 reads still run concurrently.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const certificatesEnabled = await featureFlagService.isFeatureEnabled('certificates');
    const [stats, certificates, myQuizzes, myFlashcardSets, flaggedQuestions] = await Promise.all([
      userService.getUserDashboardStats(user.id),
      certificatesEnabled ? certificateService.listCertificatesForUser(user.id) : Promise.resolve([]),
      quizService.listQuizzesByCreator(user.id),
      flashcardService.listFlashcardSetsByCreator(user.id),
      reportService.listOpenReportsForCreator(user.id),
    ]);

    return NextResponse.json({
      stats: certificatesEnabled ? stats : { ...stats, certificatesEarned: 0 },
      certificates,
      certificatesEnabled,
      myQuizzes,
      myFlashcardSets,
      flaggedQuestions,
    });
  } catch (err) {
    // Never forward raw DB/driver text (e.g. "SQL logic error: SQLITE_ERROR")
    // to the client — it means nothing to the user and reads like a crash.
    console.error('Dashboard load failed:', err);
    return NextResponse.json(
      { error: 'Something went wrong while loading your dashboard. Please try again.' },
      { status: 500 }
    );
  }
}
