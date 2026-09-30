import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { QuizInput } from '@/types';
import { checkGuestVisibilityAllowed } from '@/lib/guest/guestAccess';

/**
 * Accepts { quizzes: QuizInput[] } and creates them all, allowing a user
 * to upload many quizzes at once (e.g. from a spreadsheet/JSON export, or
 * the PDF→CSV nursing-exam pipeline).
 *
 * Before inserting anything, the batch is scanned for likely duplicates
 * (see quizService.findBulkQuizDuplicates): a quiz title that already
 * exists in the same subcategory, or a question prompt that already
 * exists in that subcategory (either in the DB already, or repeated
 * earlier in this same upload). If any are found and the caller hasn't
 * passed `confirm: true`, nothing is inserted — the report is returned
 * instead so the client can show it for review. Passing `confirm: true`
 * skips the check and uploads as-is (used once the admin has reviewed the
 * flagged items and chooses to proceed anyway).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateQuizzes(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create quizzes' }, { status: 403 });
  }

  let body: { quizzes: QuizInput[]; confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.quizzes) || body.quizzes.length === 0) {
    return NextResponse.json({ error: '"quizzes" must be a non-empty array' }, { status: 400 });
  }

  for (const [index, quiz] of body.quizzes.entries()) {
    if (!quiz.title || !quiz.subcategoryId || !quiz.questions?.length) {
      return NextResponse.json(
        { error: `Quiz at index ${index} is missing title, subcategoryId, or questions` },
        { status: 400 }
      );
    }
  }

  for (const [index, quiz] of body.quizzes.entries()) {
    if (quiz.visibility === 'guest') {
      const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: quiz.pricing });
      if (guestError) {
        return NextResponse.json({ error: `Quiz at index ${index}: ${guestError}` }, { status: 403 });
      }
    }
  }

  try {
    if (!body.confirm) {
      const duplicates = await quizService.findBulkQuizDuplicates(body.quizzes);
      const hasDuplicates =
        duplicates.duplicateTitleIndexes.length > 0 ||
        Object.keys(duplicates.duplicateQuestionsByQuizIndex).length > 0;

      if (hasDuplicates) {
        return NextResponse.json(
          {
            needsConfirmation: true,
            duplicates: {
              duplicateTitleIndexes: duplicates.duplicateTitleIndexes,
              duplicateQuestionsByQuizIndex: duplicates.duplicateQuestionsByQuizIndex,
            },
          },
          { status: 200 }
        );
      }
    }

    const created = await quizService.bulkCreateQuizzes(user.id, body.quizzes);
    return NextResponse.json({ quizzes: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bulk upload failed' },
      { status: 500 }
    );
  }
}
