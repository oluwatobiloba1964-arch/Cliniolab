// src/lib/db/services/quiz/quizCrudService.ts
// Create / update / delete / get-by-id / get-by-share-slug.
// Password & visibility logic lives in quizPasswordService.ts.

import { getDb, generateId, nowIso } from '@/lib/db/client';
import { normalizeForDedup } from '@/lib/utils/normalizeText';
import {
  type QuizRow,
  mapQuiz,
} from './quizMappers';
import type { Quiz, QuizInput } from '@/types';

const D1_BATCH_CHUNK_SIZE = 50;

async function runBatchChunked(
  db: ReturnType<typeof getDb>,
  statements: ReturnType<ReturnType<typeof getDb>['prepare']>[]
): Promise<void> {
  for (let i = 0; i < statements.length; i += D1_BATCH_CHUNK_SIZE) {
    const chunk = statements.slice(i, i + D1_BATCH_CHUNK_SIZE);
    await db.batch(chunk);
  }
}

function generateShareSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function computeExpiryDate(
  option: '1d' | '3d' | '7d' | 'custom' | undefined,
  customDate?: string
): string | null {
  if (!option) return null;
  const now = new Date();
  switch (option) {
    case '1d': now.setDate(now.getDate() + 1); return now.toISOString();
    case '3d': now.setDate(now.getDate() + 3); return now.toISOString();
    case '7d': now.setDate(now.getDate() + 7); return now.toISOString();
    case 'custom':
      if (!customDate) throw new Error('customExpiryDate is required when linkExpiry is "custom"');
      return new Date(customDate).toISOString();
    default: return null;
  }
}

export async function createQuiz(creatorId: string, input: QuizInput): Promise<Quiz> {
  const db = getDb();
  const id = generateId('quiz');
  const now = nowIso();

  const shareSlug = input.visibility === 'private' ? generateShareSlug() : null;
  const linkExpiresAt =
    input.visibility === 'private' ? computeExpiryDate(input.linkExpiry, input.customExpiryDate) : null;

  const quizStatement = db
    .prepare(
      `INSERT INTO quizzes (
        id, subcategory_id, creator_id, title, normalized_title, description, mode, difficulty,
        visibility, share_slug, link_expires_at, time_limit_seconds, time_limit_mode,
        shuffle_questions, shuffle_options,
        anti_cheat_enabled, retake_policy, retake_limit, status, pricing, price_kobo,
        allow_flagging, default_mark, show_marks, leaderboard_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.subcategoryId,
      creatorId,
      input.title,
      normalizeForDedup(input.title),
      input.description ?? null,
      input.mode,
      input.difficulty,
      input.visibility,
      shareSlug,
      linkExpiresAt,
      input.timeLimitSeconds ?? null,
      input.timeLimitMode === 'user_choice' ? 'user_choice' : 'fixed',
      input.shuffleQuestions ? 1 : 0,
      input.shuffleOptions ? 1 : 0,
      input.antiCheatEnabled ? 1 : 0,
      input.retakePolicy,
      input.retakeLimit ?? null,
      'published',
      input.pricing ?? 'free',
      input.pricing === 'paid' ? input.priceKobo ?? null : null,
      (input.allowFlagging ?? true) ? 1 : 0,
      input.defaultMark ?? 1,
      (input.showMarks ?? true) ? 1 : 0,
      (input.leaderboardEnabled ?? true) ? 1 : 0,
      now,
      now
    );

  const questionStatements = input.questions.map((q, index) =>
    db
      .prepare(
        `INSERT INTO questions (
          id, quiz_id, subcategory_id, type, prompt, normalized_prompt, options, correct_answer,
          explanation, incorrect_rationale, sort_order, mark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId('q'),
        id,
        input.subcategoryId,
        q.type,
        q.prompt,
        normalizeForDedup(q.prompt),
        q.options ? JSON.stringify(q.options) : null,
        q.correctAnswer,
        q.explanation ?? null,
        q.incorrectRationale?.trim() || null,
        index,
        q.mark ?? null
      )
  );

  try {
    await runBatchChunked(db, [quizStatement, ...questionStatements]);
  } catch (err) {
    // The quiz row + questions are inserted as one logical unit, but
    // runBatchChunked splits large batches into multiple D1 .batch() calls
    // (50 statements each), and only each individual chunk is atomic — not
    // the whole insert. If an early chunk succeeds and a later one fails
    // (e.g. a bad value a few hundred questions in), the quiz row and the
    // first N questions are left committed with the rest missing, and the
    // caller only sees a rejected promise with nothing to clean up (see
    // bulkCreateQuizzes, which can only roll back quizzes whose promise
    // fulfilled). So on any failure here, delete whatever this call
    // managed to commit for this quiz id before rethrowing, so every
    // caller always sees an all-or-nothing result.
    await db.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(id).run().catch(() => {});
    await db.prepare('DELETE FROM quizzes WHERE id = ?').bind(id).run().catch(() => {});
    throw err;
  }

  return {
    id,
    subcategoryId: input.subcategoryId,
    creatorId,
    title: input.title,
    description: input.description ?? null,
    mode: input.mode,
    difficulty: input.difficulty,
    visibility: input.visibility,
    shareSlug,
    linkExpiresAt,
    accessMode: 'link',
    hasPassword: false,
    timeLimitSeconds: input.timeLimitSeconds ?? null,
    timeLimitMode: input.timeLimitMode === 'user_choice' ? 'user_choice' : 'fixed',
    shuffleQuestions: input.shuffleQuestions ?? false,
    shuffleOptions: input.shuffleOptions ?? false,
    antiCheatEnabled: input.antiCheatEnabled,
    retakePolicy: input.retakePolicy,
    retakeLimit: input.retakeLimit ?? null,
    status: 'published',
    pricing: input.pricing ?? 'free',
    priceKobo: input.pricing === 'paid' ? input.priceKobo ?? null : null,
    allowFlagging: input.allowFlagging ?? true,
    defaultMark: input.defaultMark ?? 1,
    showMarks: input.showMarks ?? true,
    leaderboardEnabled: input.leaderboardEnabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateQuiz(quizId: string, input: QuizInput): Promise<Quiz> {
  const db = getDb();
  const now = nowIso();

  const existing = await getQuizById(quizId);
  if (!existing) throw new Error('Quiz not found');

  const shareSlug = existing.shareSlug;
  const linkExpiresAt = existing.linkExpiresAt;

  const quizStatement = db
    .prepare(
      `UPDATE quizzes SET
        subcategory_id = ?, title = ?, normalized_title = ?, description = ?, mode = ?, difficulty = ?,
        time_limit_seconds = ?, time_limit_mode = ?, shuffle_questions = ?, shuffle_options = ?,
        anti_cheat_enabled = ?, retake_policy = ?, retake_limit = ?,
        pricing = ?, price_kobo = ?, allow_flagging = ?, default_mark = ?,
        show_marks = ?, leaderboard_enabled = ?, updated_at = ?
      WHERE id = ?`
    )
    .bind(
      input.subcategoryId,
      input.title,
      normalizeForDedup(input.title),
      input.description ?? null,
      input.mode,
      input.difficulty,
      input.timeLimitSeconds ?? null,
      input.timeLimitMode === 'user_choice' ? 'user_choice' : 'fixed',
      input.shuffleQuestions ? 1 : 0,
      input.shuffleOptions ? 1 : 0,
      input.antiCheatEnabled ? 1 : 0,
      input.retakePolicy,
      input.retakeLimit ?? null,
      input.pricing ?? 'free',
      input.pricing === 'paid' ? input.priceKobo ?? null : null,
      (input.allowFlagging ?? true) ? 1 : 0,
      input.defaultMark ?? 1,
      (input.showMarks ?? true) ? 1 : 0,
      (input.leaderboardEnabled ?? true) ? 1 : 0,
      now,
      quizId
    );

  const existingIds = new Set(
    (
      await db.prepare('SELECT id FROM questions WHERE quiz_id = ?').bind(quizId).all<{ id: string }>()
    ).results.map((r) => r.id)
  );

  const incomingIds = new Set(input.questions.filter((q) => q.id).map((q) => q.id as string));
  const removedIds = [...existingIds].filter((id) => !incomingIds.has(id));

  let deletableIds: string[] = removedIds;
  if (removedIds.length > 0) {
    const placeholders = removedIds.map(() => '?').join(',');
    const [attemptRefs, reportRefs] = await Promise.all([
      db.prepare(`SELECT DISTINCT question_id FROM attempt_answers WHERE question_id IN (${placeholders})`)
        .bind(...removedIds).all<{ question_id: string }>(),
      db.prepare(`SELECT DISTINCT question_id FROM question_reports WHERE question_id IN (${placeholders})`)
        .bind(...removedIds).all<{ question_id: string }>(),
    ]);
    const referenced = new Set([
      ...attemptRefs.results.map((r) => r.question_id),
      ...reportRefs.results.map((r) => r.question_id),
    ]);
    deletableIds = removedIds.filter((id) => !referenced.has(id));
  }

  const deleteStatements = deletableIds.map((id) => db.prepare('DELETE FROM questions WHERE id = ?').bind(id));

  const questionStatements = input.questions.map((q, index) => {
    if (q.id && existingIds.has(q.id)) {
      return db
        .prepare(
          `UPDATE questions SET
            subcategory_id = ?, type = ?, prompt = ?, normalized_prompt = ?, options = ?, correct_answer = ?,
            explanation = ?, incorrect_rationale = ?, sort_order = ?, mark = ?
          WHERE id = ?`
        )
        .bind(
          input.subcategoryId,
          q.type,
          q.prompt,
          normalizeForDedup(q.prompt),
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer,
          q.explanation ?? null,
          q.incorrectRationale?.trim() || null,
          index,
          q.mark ?? null,
          q.id
        );
    }
    return db
      .prepare(
        `INSERT INTO questions (
          id, quiz_id, subcategory_id, type, prompt, normalized_prompt, options, correct_answer,
          explanation, incorrect_rationale, sort_order, mark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId('q'),
        quizId,
        input.subcategoryId,
        q.type,
        q.prompt,
        normalizeForDedup(q.prompt),
        q.options ? JSON.stringify(q.options) : null,
        q.correctAnswer,
        q.explanation ?? null,
        q.incorrectRationale?.trim() || null,
        index,
        q.mark ?? null
      );
  });

  await db.batch([quizStatement, ...deleteStatements]);
  await runBatchChunked(db, questionStatements);

  return {
    ...existing,
    subcategoryId: input.subcategoryId,
    title: input.title,
    description: input.description ?? null,
    mode: input.mode,
    difficulty: input.difficulty,
    shareSlug,
    linkExpiresAt,
    timeLimitSeconds: input.timeLimitSeconds ?? null,
    timeLimitMode: input.timeLimitMode === 'user_choice' ? 'user_choice' : 'fixed',
    shuffleQuestions: input.shuffleQuestions ?? false,
    shuffleOptions: input.shuffleOptions ?? false,
    antiCheatEnabled: input.antiCheatEnabled,
    retakePolicy: input.retakePolicy,
    retakeLimit: input.retakeLimit ?? null,
    pricing: input.pricing ?? 'free',
    priceKobo: input.pricing === 'paid' ? input.priceKobo ?? null : null,
    allowFlagging: input.allowFlagging ?? true,
    defaultMark: input.defaultMark ?? 1,
    showMarks: input.showMarks ?? true,
    leaderboardEnabled: input.leaderboardEnabled ?? true,
    updatedAt: now,
  };
}

export async function getQuizById(id: string): Promise<Quiz | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM quizzes WHERE id = ?').bind(id).first<QuizRow>();
  return row ? mapQuiz(row) : null;
}

export async function getQuizByShareSlug(slug: string): Promise<Quiz | null> {
  const db = getDb();
  const row = await db
    .prepare("SELECT * FROM quizzes WHERE share_slug = ? AND visibility = 'private'")
    .bind(slug)
    .first<QuizRow>();
  if (!row) return null;

  const quiz = mapQuiz(row);
  if (quiz.accessMode === 'link' && quiz.linkExpiresAt && new Date(quiz.linkExpiresAt).getTime() < Date.now()) {
    return null;
  }
  return quiz;
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const db = getDb();

  const { results: questionRows } = await db
    .prepare('SELECT id FROM questions WHERE quiz_id = ?').bind(quizId).all<{ id: string }>();
  const questionIds = questionRows.map((r) => r.id);

  const { results: commentRows } = await db
    .prepare('SELECT id FROM comments WHERE quiz_id = ?').bind(quizId).all<{ id: string }>();
  const commentIds = commentRows.map((r) => r.id);

  const CHUNK_SIZE = 100;
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const placeholders = (n: number) => Array(n).fill('?').join(', ');

  if (questionIds.length > 0) {
    for (const idsChunk of chunk(questionIds, CHUNK_SIZE)) {
      await db.prepare(`DELETE FROM question_reports WHERE question_id IN (${placeholders(idsChunk.length)})`)
        .bind(...idsChunk).run();
      await db.prepare(`DELETE FROM attempt_answers WHERE question_id IN (${placeholders(idsChunk.length)})`)
        .bind(...idsChunk).run();
    }
  }

  if (commentIds.length > 0) {
    for (const idsChunk of chunk(commentIds, CHUNK_SIZE)) {
      await db.prepare(`DELETE FROM comment_reactions WHERE comment_id IN (${placeholders(idsChunk.length)})`)
        .bind(...idsChunk).run();
    }
  }

  await db.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId).run();
  await db.prepare('DELETE FROM quiz_attempts WHERE quiz_id = ?').bind(quizId).run();
  // study_attempts.quiz_id REFERENCES quizzes(id) (see
  // src/db/migrations/2026-09-add-study-attempts.sql) but this delete was
  // missing, so any quiz with a recorded study-mode attempt could never be
  // deleted - the final DELETE FROM quizzes below would fail with a
  // foreign key constraint violation ("SQL logic error: SQLITE_ERROR"),
  // leaving a broken, un-deletable quiz row behind.
  await db.prepare('DELETE FROM study_attempts WHERE quiz_id = ?').bind(quizId).run();
  await db.prepare('DELETE FROM comments WHERE quiz_id = ?').bind(quizId).run();
  await db.prepare('DELETE FROM certificates WHERE quiz_id = ?').bind(quizId).run();
  await db.prepare('DELETE FROM quiz_purchases WHERE quiz_id = ?').bind(quizId).run();
  await db.prepare('DELETE FROM quizzes WHERE id = ?').bind(quizId).run();
}
