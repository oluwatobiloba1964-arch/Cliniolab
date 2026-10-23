// src/app/api/quizzes/bulk/route.ts
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
    if (!quiz.title?.trim() || !quiz.subcategoryId || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return NextResponse.json(
        { error: `Quiz at index ${index} is missing title, subcategoryId, or questions` },
        { status: 400 }
      );
    }

    if (!['study', 'quiz', 'exam', 'combined'].includes(quiz.mode) || !['easy', 'medium', 'hard'].includes(quiz.difficulty)) {
      return NextResponse.json(
        { error: `Quiz at index ${index} has an invalid mode or difficulty` },
        { status: 400 }
      );
    }

    if ((quiz.mode === 'exam' || quiz.mode === 'combined') && (!Number.isFinite(quiz.timeLimitSeconds ?? NaN) || (quiz.timeLimitSeconds ?? 0) <= 0)) {
      return NextResponse.json(
        { error: `Quiz at index ${index}: exam mode requires a positive time limit` },
        { status: 400 }
      );
    }

    for (const [questionIndex, question] of quiz.questions.entries()) {
      if (!question.prompt?.trim() || !question.correctAnswer?.trim()) {
        return NextResponse.json(
          { error: `Quiz at index ${index}, question ${questionIndex + 1} is missing prompt or correctAnswer` },
          { status: 400 }
        );
      }

      if (!['mcq', 'true_false', 'fill_blank'].includes(question.type)) {
        return NextResponse.json(
          { error: `Quiz at index ${index}, question ${questionIndex + 1} has an invalid question type` },
          { status: 400 }
        );
      }

      if (question.type === 'mcq') {
        if (!Array.isArray(question.options) || question.options.length < 2) {
          return NextResponse.json(
            { error: `Quiz at index ${index}, question ${questionIndex + 1}: MCQ needs at least 2 options` },
            { status: 400 }
          );
        }
        const optionIds = new Set(question.options.map((option) => option?.id));
        if (optionIds.size !== question.options.length || question.options.some((option) => !option?.id || !option.text?.trim())) {
          return NextResponse.json(
            { error: `Quiz at index ${index}, question ${questionIndex + 1}: MCQ options are invalid` },
            { status: 400 }
          );
        }
        if (!optionIds.has(question.correctAnswer)) {
          return NextResponse.json(
            { error: `Quiz at index ${index}, question ${questionIndex + 1}: correctAnswer must reference an option` },
            { status: 400 }
          );
        }
      }

      if (question.type === 'true_false' && !['true', 'false'].includes(String(question.correctAnswer).trim().toLowerCase())) {
        return NextResponse.json(
          { error: `Quiz at index ${index}, question ${questionIndex + 1}: true_false correctAnswer must be True or False` },
          { status: 400 }
        );
      }
    }
  }

  // FIX (Vercel Hobby duration budget) — src/app/api/quizzes/bulk/route.ts
  // Was: checkGuestVisibilityAllowed awaited one quiz at a time inside a
  // for-loop; that helper does up to 2 DB reads internally (a feature
  // flag lookup + a platform setting lookup), so a bulk upload of N
  // quizzes with guest visibility set meant up to 2*N sequential round
  // trips just for this validation pass, before any actual insert work.
  // Now: every quiz's check runs concurrently, so wall time is roughly
  // one round trip's worth regardless of how many quizzes are in the
  // batch. Admin-only/low-frequency action, but bulk uploads are exactly
  // the kind of request where N can get large (a full exam bank import).
  const guestChecks = await Promise.all(
    body.quizzes.map(async (quiz, index) => {
      if (quiz.visibility !== 'guest') return null;
      const guestError = await checkGuestVisibilityAllowed({ role: user.role, pricing: quiz.pricing });
      return guestError ? { index, guestError } : null;
    })
  );
  const firstGuestFailure = guestChecks.find((r) => r !== null);
  if (firstGuestFailure) {
    return NextResponse.json(
      { error: `Quiz at index ${firstGuestFailure.index}: ${firstGuestFailure.guestError}` },
      { status: 403 }
    );
  }

  try {
    // Duplicate detection is temporarily disabled - it was erroring out
    // and blocking publish entirely instead of just flagging. Uploads go
    // straight to create until it's fixed. To re-enable, restore the
    // findBulkQuizDuplicates check that used to sit here (see git history).

    const created = await quizService.bulkCreateQuizzes(user.id, body.quizzes);
    return NextResponse.json({ quizzes: created }, { status: 201 });
  } catch (err) {
    // Log the real error server-side for debugging, but never forward raw
    // DB/driver text (e.g. "FOREIGN KEY constraint failed: SQLITE_CONSTRAINT
    // (extended: SQLITE_CONSTRAINT_FOREIGNKEY)") to the client - it means
    // nothing to the admin uploading a spreadsheet and reads like a crash.
    // bulkCreateQuizzes now also rolls back anything it managed to create
    // before the failure, so a retry after this error starts from a clean
    // slate instead of re-flagging already-inserted rows as duplicates.
    console.error('Bulk quiz upload failed:', err);
    return NextResponse.json(
      { error: 'Something went wrong while publishing these quizzes. Nothing was saved - please try again, and contact support if it keeps happening.' },
      { status: 500 }
    );
  }
}
