// src/lib/db/services/quiz/quizRelatedService.ts
// "Related quizzes" widgets: same subcategory -> same category -> latest fallback.

import { getDb } from '@/lib/db/client';
import { type QuizStatsRow, mapQuizWithStats } from './quizMappers';
import type { QuizWithStats } from '@/types';

const BASE_SELECT = `
  q.*,
  (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
  (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
  (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
   FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
  (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
  u.display_name as creator_name,
  u.contact_phone as creator_contact
`;

export async function listRelatedQuizzes(
  subcategoryId: string,
  excludeQuizId: string | null,
  limit = 3
): Promise<QuizWithStats[]> {
  const db = getDb();
  const excludeClause = excludeQuizId ? 'AND q.id != ?' : '';
  const excludeArgs = excludeQuizId ? [excludeQuizId] : [];

  const { results: sameSubcategory } = await db
    .prepare(
      `SELECT ${BASE_SELECT}
       FROM quizzes q JOIN users u ON u.id = q.creator_id
       WHERE q.subcategory_id = ? AND q.visibility = 'public' AND q.status = 'published'
         ${excludeClause}
       ORDER BY q.updated_at DESC LIMIT ?`
    )
    .bind(subcategoryId, ...excludeArgs, limit)
    .all<QuizStatsRow>();

  const picked = sameSubcategory.map(mapQuizWithStats);
  if (picked.length >= limit) return picked.slice(0, limit);

  const pickedIds = new Set(picked.map((q) => q.id));
  const remaining = limit - picked.length;

  const { results: sameCategory } = await db
    .prepare(
      `SELECT ${BASE_SELECT}
       FROM quizzes q JOIN users u ON u.id = q.creator_id
       JOIN subcategories s ON s.id = q.subcategory_id
       WHERE s.category_id = (SELECT category_id FROM subcategories WHERE id = ?)
         AND q.subcategory_id != ?
         AND q.visibility = 'public' AND q.status = 'published'
         ${excludeClause}
       ORDER BY q.updated_at DESC LIMIT ?`
    )
    .bind(subcategoryId, subcategoryId, ...excludeArgs, remaining)
    .all<QuizStatsRow>();

  for (const row of sameCategory) {
    if (picked.length >= limit) break;
    if (!pickedIds.has(row.id)) {
      picked.push(mapQuizWithStats(row));
      pickedIds.add(row.id);
    }
  }

  if (picked.length >= limit) return picked.slice(0, limit);

  const { results: latest } = await db
    .prepare(
      `SELECT ${BASE_SELECT}
       FROM quizzes q JOIN users u ON u.id = q.creator_id
       WHERE q.visibility = 'public' AND q.status = 'published'
         ${excludeClause}
       ORDER BY q.updated_at DESC LIMIT ?`
    )
    .bind(...excludeArgs, limit - picked.length + picked.length)
    .all<QuizStatsRow>();

  for (const row of latest) {
    if (picked.length >= limit) break;
    if (!pickedIds.has(row.id)) {
      picked.push(mapQuizWithStats(row));
      pickedIds.add(row.id);
    }
  }

  return picked.slice(0, limit);
}

export async function listRelatedQuizzesByLabel(
  categoryLabel: string | null,
  limit = 3
): Promise<QuizWithStats[]> {
  const db = getDb();
  const picked: QuizWithStats[] = [];
  const pickedIds = new Set<string>();

  if (categoryLabel && categoryLabel.trim()) {
    const label = categoryLabel.trim();

    const { results: bySubcategory } = await db
      .prepare(
        `SELECT ${BASE_SELECT}
         FROM quizzes q JOIN users u ON u.id = q.creator_id
         JOIN subcategories s ON s.id = q.subcategory_id
         WHERE LOWER(s.name) = LOWER(?) AND q.visibility = 'public' AND q.status = 'published'
         ORDER BY q.updated_at DESC LIMIT ?`
      )
      .bind(label, limit)
      .all<QuizStatsRow>();

    for (const row of bySubcategory) {
      if (picked.length >= limit) break;
      picked.push(mapQuizWithStats(row));
      pickedIds.add(row.id);
    }

    if (picked.length < limit) {
      const { results: byCategory } = await db
        .prepare(
          `SELECT ${BASE_SELECT}
           FROM quizzes q JOIN users u ON u.id = q.creator_id
           JOIN subcategories s ON s.id = q.subcategory_id
           JOIN categories c ON c.id = s.category_id
           WHERE LOWER(c.name) = LOWER(?) AND q.visibility = 'public' AND q.status = 'published'
           ORDER BY q.updated_at DESC LIMIT ?`
        )
        .bind(label, limit - picked.length)
        .all<QuizStatsRow>();

      for (const row of byCategory) {
        if (picked.length >= limit) break;
        if (!pickedIds.has(row.id)) {
          picked.push(mapQuizWithStats(row));
          pickedIds.add(row.id);
        }
      }
    }
  }

  if (picked.length < limit) {
    const excludeClause = pickedIds.size > 0
      ? `AND q.id NOT IN (${[...pickedIds].map(() => '?').join(',')})`
      : '';
    const { results: latest } = await db
      .prepare(
        `SELECT ${BASE_SELECT}
         FROM quizzes q JOIN users u ON u.id = q.creator_id
         WHERE q.visibility = 'public' AND q.status = 'published' ${excludeClause}
         ORDER BY q.updated_at DESC LIMIT ?`
      )
      .bind(...pickedIds, limit - picked.length)
      .all<QuizStatsRow>();

    for (const row of latest) {
      if (picked.length >= limit) break;
      picked.push(mapQuizWithStats(row));
    }
  }

  return picked.slice(0, limit);
}
