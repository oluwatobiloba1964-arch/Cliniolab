import { getDb } from '@/lib/db/client';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  total_score: number;
  quizzes_taken: number;
  avg_percentage: number;
}

function mapEntries(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name ?? 'Anonymous',
    totalScore: row.total_score,
    quizzesTaken: row.quizzes_taken,
    averagePercentage: row.avg_percentage,
    rank: index + 1,
  }));
}

/** Site-wide leaderboard backed by incrementally maintained user aggregates. */
export async function getGeneralLeaderboard(limit = 16): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        s.user_id as user_id,
        u.display_name as display_name,
        s.total_score as total_score,
        s.quizzes_taken as quizzes_taken,
        CASE
          WHEN s.quizzes_taken > 0 THEN s.percentage_sum / s.quizzes_taken
          ELSE 0
        END as avg_percentage
      FROM leaderboard_user_stats s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.total_score DESC, s.user_id ASC
      LIMIT ?`
    )
    .bind(limit)
    .all<LeaderboardRow>();

  return mapEntries(results);
}

/**
 * Returns a user's site-wide rank without scanning quiz_attempts.
 * Users with the same total score share the same rank.
 */
export async function getUserGeneralRank(userId: string): Promise<number | null> {
  const db = getDb();

  const user = await db
    .prepare(`SELECT total_score FROM leaderboard_user_stats WHERE user_id = ?`)
    .bind(userId)
    .first<{ total_score: number }>();

  if (!user) return null;

  const row = await db
    .prepare(
      `SELECT COUNT(*) as rank
       FROM leaderboard_user_stats
       WHERE total_score > ?`
    )
    .bind(user.total_score)
    .first<{ rank: number }>();

  return (row?.rank ?? 0) + 1;
}

/** Top 10 for a specific category. */
export async function getCategoryLeaderboard(
  categoryId: string,
  limit = 16
): Promise<LeaderboardEntry[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        a.user_id as user_id,
        u.display_name as display_name,
        SUM(a.score) as total_score,
        COUNT(*) as quizzes_taken,
        AVG(CAST(a.score AS REAL) / a.total_questions * 100) as avg_percentage
      FROM quiz_attempts a
      JOIN users u ON u.id = a.user_id
      JOIN quizzes q ON q.id = a.quiz_id
      JOIN subcategories s ON s.id = q.subcategory_id
      WHERE a.counts_for_leaderboard = 1
        AND s.category_id = ?
      GROUP BY a.user_id
      ORDER BY total_score DESC
      LIMIT ?`
    )
    .bind(categoryId, limit)
    .all<LeaderboardRow>();

  return mapEntries(results);
}

/**
 * A user's real rank on a category leaderboard.
 */
export async function getUserCategoryRank(
  categoryId: string,
  userId: string
): Promise<number | null> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT a.user_id as user_id
      FROM quiz_attempts a
      JOIN quizzes q ON q.id = a.quiz_id
      JOIN subcategories s ON s.id = q.subcategory_id
      WHERE a.counts_for_leaderboard = 1
        AND s.category_id = ?
      GROUP BY a.user_id
      ORDER BY SUM(a.score) DESC`
    )
    .bind(categoryId)
    .all<{ user_id: string }>();

  const index = results.findIndex((row) => row.user_id === userId);

  return index === -1 ? null : index + 1;
}

/**
 * Top scorers for one specific quiz/exam.
 */
export async function getQuizLeaderboard(
  quizId: string,
  limit = 16
): Promise<LeaderboardEntry[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        a.user_id as user_id,
        u.display_name as display_name,
        MAX(a.score) as total_score,
        COUNT(*) as quizzes_taken,
        MAX(CAST(a.score AS REAL) / a.total_questions * 100) as avg_percentage
      FROM quiz_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.quiz_id = ?
        AND a.counts_for_leaderboard = 1
      GROUP BY a.user_id
      ORDER BY avg_percentage DESC
      LIMIT ?`
    )
    .bind(quizId, limit)
    .all<LeaderboardRow>();

  return mapEntries(results);
}

/**
 * A user's real rank on a single quiz leaderboard.
 */
export async function getUserQuizRank(
  quizId: string,
  userId: string
): Promise<number | null> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT a.user_id as user_id
      FROM quiz_attempts a
      WHERE a.quiz_id = ?
        AND a.counts_for_leaderboard = 1
      GROUP BY a.user_id
      ORDER BY MAX(
        CAST(a.score AS REAL) / a.total_questions * 100
      ) DESC`
    )
    .bind(quizId)
    .all<{ user_id: string }>();

  const index = results.findIndex((row) => row.user_id === userId);

  return index === -1 ? null : index + 1;
}
