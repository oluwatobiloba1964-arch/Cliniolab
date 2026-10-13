// src/lib/db/services/quiz/quizBulkService.ts
// Bulk create + pre-flight duplicate detection. All-or-nothing rollback.

import { getDb, generateId, nowIso } from '@/lib/db/client';
import { normalizeForDedup } from '@/lib/utils/normalizeText';
import { createQuiz, deleteQuiz } from './quizCrudService';
import type { Quiz, QuizInput } from '@/types';

export async function bulkCreateQuizzes(creatorId: string, inputs: QuizInput[]): Promise<Quiz[]> {
  const results = await Promise.allSettled(inputs.map((input) => createQuiz(creatorId, input)));

  const created: Quiz[] = [];
  let firstError: unknown = null;

  for (const result of results) {
    if (result.status === 'fulfilled') created.push(result.value);
    else if (firstError === null) firstError = result.reason;
  }

  if (firstError !== null) {
    await Promise.all(
      created.map((quiz) =>
        deleteQuiz(quiz.id).catch(() => {
          // Best-effort cleanup — surfacing the original error is more useful
          // than a secondary cleanup failure.
        })
      )
    );
    throw firstError;
  }

  return created;
}

export interface BulkQuizDuplicateReport {
  duplicateTitleIndexes: number[];
  duplicateQuestionsByQuizIndex: Record<
    number,
    { prompt: string; reason: 'already_in_subcategory' | 'duplicate_in_quiz' }[]
  >;
}

const DEDUP_IN_CHUNK_SIZE = 100;

async function fetchMatchingNormalized(
  db: ReturnType<typeof getDb>,
  table: 'quizzes' | 'questions',
  column: 'normalized_title' | 'normalized_prompt',
  subcategoryId: string,
  normalizedValues: string[]
): Promise<Set<string>> {
  const found = new Set<string>();
  const uniqueValues = [...new Set(normalizedValues)];

  for (let i = 0; i < uniqueValues.length; i += DEDUP_IN_CHUNK_SIZE) {
    const chunk = uniqueValues.slice(i, i + DEDUP_IN_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT ${column} AS value FROM ${table}
         WHERE subcategory_id = ? AND ${column} IN (${placeholders})`
      )
      .bind(subcategoryId, ...chunk)
      .all<{ value: string }>();
    for (const row of results) found.add(row.value);
  }
  return found;
}

export async function findBulkQuizDuplicates(inputs: QuizInput[]): Promise<BulkQuizDuplicateReport> {
  const db = getDb();

  const normalizedTitlesBySubcat = new Map<string, Set<string>>();
  const normalizedPromptsBySubcat = new Map<string, Set<string>>();

  for (const input of inputs) {
    if (!normalizedTitlesBySubcat.has(input.subcategoryId)) {
      normalizedTitlesBySubcat.set(input.subcategoryId, new Set());
      normalizedPromptsBySubcat.set(input.subcategoryId, new Set());
    }
    normalizedTitlesBySubcat.get(input.subcategoryId)!.add(normalizeForDedup(input.title));
    for (const q of input.questions) {
      normalizedPromptsBySubcat.get(input.subcategoryId)!.add(normalizeForDedup(q.prompt));
    }
  }

  const subcategoryIds = [...normalizedTitlesBySubcat.keys()];
  const existingTitlesBySubcat = new Map<string, Set<string>>();
  const existingPromptsBySubcat = new Map<string, Set<string>>();

  await Promise.all(
    subcategoryIds.map(async (subcategoryId) => {
      const [titleMatches, promptMatches] = await Promise.all([
        fetchMatchingNormalized(
          db, 'quizzes', 'normalized_title', subcategoryId,
          [...normalizedTitlesBySubcat.get(subcategoryId)!]
        ),
        fetchMatchingNormalized(
          db, 'questions', 'normalized_prompt', subcategoryId,
          [...normalizedPromptsBySubcat.get(subcategoryId)!]
        ),
      ]);
      existingTitlesBySubcat.set(subcategoryId, titleMatches);
      existingPromptsBySubcat.set(subcategoryId, promptMatches);
    })
  );

  const duplicateTitleIndexes: number[] = [];
  const duplicateQuestionsByQuizIndex: BulkQuizDuplicateReport['duplicateQuestionsByQuizIndex'] = {};
  const seenInBatchBySubcat = new Map<string, Set<string>>();

  inputs.forEach((input, quizIndex) => {
    const existingTitles = existingTitlesBySubcat.get(input.subcategoryId) ?? new Set();
    if (existingTitles.has(normalizeForDedup(input.title))) duplicateTitleIndexes.push(quizIndex);

    const existingPrompts = existingPromptsBySubcat.get(input.subcategoryId) ?? new Set();
    if (!seenInBatchBySubcat.has(input.subcategoryId)) seenInBatchBySubcat.set(input.subcategoryId, new Set());
    const seenInBatch = seenInBatchBySubcat.get(input.subcategoryId)!;

    for (const q of input.questions) {
      const key = normalizeForDedup(q.prompt);
      if (existingPrompts.has(key)) {
        (duplicateQuestionsByQuizIndex[quizIndex] ??= []).push({
          prompt: q.prompt, reason: 'already_in_subcategory',
        });
      } else if (seenInBatch.has(key)) {
        (duplicateQuestionsByQuizIndex[quizIndex] ??= []).push({
          prompt: q.prompt, reason: 'duplicate_in_quiz',
        });
      }
      seenInBatch.add(key);
    }
  });

  return { duplicateTitleIndexes, duplicateQuestionsByQuizIndex };
}

// Re-exported so callers don't need to import from two places.
export { generateId, nowIso };
