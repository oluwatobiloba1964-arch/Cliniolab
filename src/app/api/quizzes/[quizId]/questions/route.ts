// src/app/api/quizzes/[quizId]/questions/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { QuizQuestionInput } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Appends questions to an existing quiz, without touching its existing
 * questions or any quiz-level settings. This is the "upload more
 * questions to an existing quiz" counterpart to /api/quizzes/bulk (which
 * only ever creates whole new quizzes) and to PATCH /api/quizzes/[quizId]
 * (which treats its `questions` array as the full, authoritative set and
 * will delete anything the caller leaves out — fine for the quiz edit
 * form, dangerous for "just add these few questions").
 *
 * Accepts { questions: QuizQuestionInput[] }. Any `id` on an input item
 * is ignored — every item here is always inserted as a new question.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this quiz' }, { status: 403 });
  }

  let body: { questions: QuizQuestionInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json({ error: '"questions" must be a non-empty array' }, { status: 400 });
  }

  for (const [index, question] of body.questions.entries()) {
    if (!question.prompt?.trim() || !question.correctAnswer?.trim()) {
      return NextResponse.json(
        { error: `Question ${index + 1} is missing prompt or correctAnswer` },
        { status: 400 }
      );
    }

    if (!['mcq', 'true_false', 'fill_blank'].includes(question.type)) {
      return NextResponse.json(
        { error: `Question ${index + 1} has an invalid question type` },
        { status: 400 }
      );
    }

    if (question.type === 'mcq') {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        return NextResponse.json(
          { error: `Question ${index + 1}: MCQ needs at least 2 options` },
          { status: 400 }
        );
      }
      const optionIds = new Set(question.options.map((option) => option?.id));
      if (optionIds.size !== question.options.length || question.options.some((option) => !option?.id || !option.text?.trim())) {
        return NextResponse.json(
          { error: `Question ${index + 1}: MCQ options are invalid` },
          { status: 400 }
        );
      }
      if (!optionIds.has(question.correctAnswer)) {
        return NextResponse.json(
          { error: `Question ${index + 1}: correctAnswer must reference an option` },
          { status: 400 }
        );
      }
    }

    if (question.type === 'true_false' && !['true', 'false'].includes(String(question.correctAnswer).trim().toLowerCase())) {
      return NextResponse.json(
        { error: `Question ${index + 1}: true_false correctAnswer must be True or False` },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await quizService.addQuestionsToQuiz(quizId, body.questions);
    return NextResponse.json({ quiz: updated, added: body.questions.length }, { status: 201 });
  } catch (err) {
    console.error(`Adding questions to quiz ${quizId} failed:`, err);
    return NextResponse.json(
      { error: 'Something went wrong while adding these questions. Nothing was saved - please try again, and contact support if it keeps happening.' },
      { status: 500 }
    );
  }
}
