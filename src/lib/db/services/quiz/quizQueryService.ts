// src/lib/db/services/quiz/quizQueryService.ts
// Every list/get read query. All public feeds use bounded, indexed queries.

import { getDb } from '@/lib/db/client';
import { type QuestionRow, type QuizStatsRow, mapQuestion, mapQuizWithStats } from './quizMappers';
import type { QuizQuestion, QuizWithStats } from '@/types';

export async function getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC')
    .bind(quizId)
    .all<QuestionRow>();
  return results.map(mapQuestion);
}

export async function listLatestPublicQuizzes(limit = 20): Promise<QuizWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        c.name as category_name,
        s.name as subcategory_name,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN subcategories s ON s.id = q.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = q.creator_id
      WHERE q.visibility = 'public' AND q.status = 'published'
      ORDER BY q.updated_at DESC
      LIMIT ?`
    )
    .bind(limit)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

export async function listLatestPublicQuizzesPaginated(
  page = 1,
  pageSize = 12
): Promise<{ quizzes: QuizWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);

  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT
          q.*,
          (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
          (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
          (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
           FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
          (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
          c.name as category_name,
          s.name as subcategory_name,
          u.display_name as creator_name,
          u.contact_phone as creator_contact
        FROM quizzes q
        JOIN subcategories s ON s.id = q.subcategory_id
        JOIN categories c ON c.id = s.category_id
        JOIN users u ON u.id = q.creator_id
        WHERE q.visibility = 'public' AND q.status = 'published'
        ORDER BY q.updated_at DESC
        LIMIT ? OFFSET ?`
      )
      .bind(pageSize, offset)
      .all<QuizStatsRow>(),
    db
      .prepare(
        `SELECT COUNT(*) as total FROM quizzes q
         WHERE q.visibility = 'public' AND q.status = 'published'`
      )
      .first<{ total: number }>(),
  ]);

  return { quizzes: results.map(mapQuizWithStats), total: countRow?.total ?? 0, page, pageSize };
}

export async function getQuizzesWithStatsByIds(ids: string[]): Promise<QuizWithStats[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT COUNT(*) FROM study_attempts WHERE quiz_id = q.id) as study_attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        c.name as category_name,
        s.name as subcategory_name,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN subcategories s ON s.id = q.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = q.creator_id
      WHERE q.id IN (${placeholders})`
    )
    .bind(...ids)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

/**
 * Public homepage feed: one indexed, already-LIMITed query per category, run in parallel.
 * Avoids the ROW_NUMBER() full-table scan this replaced.
 */
export async function listQuizzesByCategories(
  categoryIds: string[],
  limit = 7,
  options: { includeCommentCount?: boolean } = {}
): Promise<Record<string, QuizWithStats[]>> {
  const includeCommentCount = options.includeCommentCount !== false;
  const grouped: Record<string, QuizWithStats[]> = {};
  if (!categoryIds.length) return grouped;

  const db = getDb();
  const perCategory = await Promise.all(
    categoryIds.map((categoryId) =>
      db
        .prepare(
          `SELECT
            q.*,
            COALESCE(qcs.question_count, 0) AS question_count,
            COALESCE(qas.attempt_count, 0) AS attempt_count,
            CASE WHEN qas.attempt_count > 0
              THEN qas.percentage_sum / qas.attempt_count
              ELSE NULL END AS avg_score,
            ${includeCommentCount ? 'COALESCE(qcs.comment_count, 0) AS comment_count' : '0 AS comment_count'},
            u.display_name AS creator_name,
            u.contact_phone AS creator_contact
          FROM quizzes q
          JOIN subcategories s ON s.id = q.subcategory_id
          JOIN users u ON u.id = q.creator_id
          LEFT JOIN quiz_attempt_stats qas ON qas.quiz_id = q.id
          LEFT JOIN quiz_content_stats qcs ON qcs.quiz_id = q.id
          WHERE s.category_id = ? AND q.visibility = 'public' AND q.status = 'published'
          ORDER BY q.updated_at DESC
          LIMIT ?`
        )
        .bind(categoryId, limit)
        .all<QuizStatsRow>()
    )
  );

  categoryIds.forEach((categoryId, i) => {
    grouped[categoryId] = perCategory[i].results.map(mapQuizWithStats);
  });
  return grouped;
}

export async function listQuizzesByCategoryPaginated(
  categoryId: string,
  page = 1,
  pageSize = 25
): Promise<{ quizzes: QuizWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);

  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT
          q.*,
          (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
          (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
          (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
           FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
          (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
          u.display_name as creator_name,
          u.contact_phone as creator_contact
        FROM quizzes q
        JOIN subcategories s ON s.id = q.subcategory_id
        JOIN users u ON u.id = q.creator_id
        WHERE s.category_id = ? AND q.visibility = 'public' AND q.status = 'published'
        ORDER BY q.updated_at DESC
        LIMIT ? OFFSET ?`
      )
      .bind(categoryId, pageSize, offset)
      .all<QuizStatsRow>(),
    db
      .prepare(
        `SELECT COUNT(*) as total FROM quizzes q
         JOIN subcategories s ON s.id = q.subcategory_id
         WHERE s.category_id = ? AND q.visibility = 'public' AND q.status = 'published'`
      )
      .bind(categoryId)
      .first<{ total: number }>(),
  ]);

  return { quizzes: results.map(mapQuizWithStats), total: countRow?.total ?? 0, page, pageSize };
}

export async function listQuizzesByCategory(categoryId: string, limit?: number): Promise<QuizWithStats[]> {
  const db = getDb();
  const query = `SELECT
      q.*,
      (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
      (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
       FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
      (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
      u.display_name as creator_name,
      u.contact_phone as creator_contact
    FROM quizzes q
    JOIN subcategories s ON s.id = q.subcategory_id
    JOIN users u ON u.id = q.creator_id
    WHERE s.category_id = ? AND q.visibility = 'public' AND q.status = 'published'
    ORDER BY q.updated_at DESC${limit ? ' LIMIT ?' : ''}`;
  const stmt = limit ? db.prepare(query).bind(categoryId, limit) : db.prepare(query).bind(categoryId);
  const { results } = await stmt.all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

export async function listQuizzesBySubcategoryPaginated(
  subcategoryId: string,
  page = 1,
  pageSize = 25
): Promise<{ quizzes: QuizWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);

  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT
          q.*,
          (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
          (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
          (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
           FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
          (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
          u.display_name as creator_name,
          u.contact_phone as creator_contact
        FROM quizzes q
        JOIN users u ON u.id = q.creator_id
        WHERE q.subcategory_id = ? AND q.visibility = 'public' AND q.status = 'published'
        ORDER BY q.updated_at DESC
        LIMIT ? OFFSET ?`
      )
      .bind(subcategoryId, pageSize, offset)
      .all<QuizStatsRow>(),
    db
      .prepare(
        `SELECT COUNT(*) as total FROM quizzes q
         WHERE q.subcategory_id = ? AND q.visibility = 'public' AND q.status = 'published'`
      )
      .bind(subcategoryId)
      .first<{ total: number }>(),
  ]);

  return { quizzes: results.map(mapQuizWithStats), total: countRow?.total ?? 0, page, pageSize };
}

export async function listQuizzesBySubcategory(subcategoryId: string): Promise<QuizWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN users u ON u.id = q.creator_id
      WHERE q.subcategory_id = ? AND q.visibility = 'public' AND q.status = 'published'
      ORDER BY q.updated_at DESC`
    )
    .bind(subcategoryId)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

export async function listQuizzesByCreator(creatorId: string): Promise<QuizWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
      FROM quizzes q
      WHERE q.creator_id = ?
      ORDER BY q.updated_at DESC`
    )
    .bind(creatorId)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

export async function listPublicQuizzesByCreator(creatorId: string): Promise<QuizWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT COUNT(*) FROM study_attempts WHERE quiz_id = q.id) as study_attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
      FROM quizzes q
      WHERE q.creator_id = ? AND q.visibility = 'public'
      ORDER BY q.updated_at DESC`
    )
    .bind(creatorId)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}

export async function adminListAllQuizzes(
  page = 1,
  pageSize = 20
): Promise<{ quizzes: QuizWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);

  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT
          q.*,
          (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
          (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
          (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
           FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
          (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
        FROM quizzes q
        ORDER BY q.updated_at DESC
        LIMIT ? OFFSET ?`
      )
      .bind(pageSize, offset)
      .all<QuizStatsRow>(),
    db.prepare('SELECT COUNT(*) as total FROM quizzes').first<{ total: number }>(),
  ]);

  return { quizzes: results.map(mapQuizWithStats), total: countRow?.total ?? 0, page, pageSize };
}

export async function searchPublicQuizzes(query: string): Promise<QuizWithStats[]> {
  const db = getDb();
  const like = `%${query}%`;
  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        c.name as category_name,
        s.name as subcategory_name,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN subcategories s ON s.id = q.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = q.creator_id
      WHERE q.visibility = 'public' AND q.status = 'published'
        AND (q.title LIKE ? OR s.name LIKE ? OR c.name LIKE ?)
      ORDER BY q.updated_at DESC
      LIMIT 50`
    )
    .bind(like, like, like)
    .all<QuizStatsRow>();
  return results.map(mapQuizWithStats);
}
