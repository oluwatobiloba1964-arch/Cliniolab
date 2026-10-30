import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { QuestionReport, QuestionReportWithContext, ReportStatus } from '@/types';

interface ReportRow {
  id: string;
  question_id: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
}

interface ReportWithContextRow extends ReportRow {
  question_prompt: string;
  quiz_id: string;
  quiz_title: string;
  reporter_name: string | null;
}

function mapReport(row: ReportRow): QuestionReport {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    reason: row.reason,
    status: row.status as ReportStatus,
    createdAt: row.created_at,
  };
}

function mapReportWithContext(row: ReportWithContextRow): QuestionReportWithContext {
  return {
    ...mapReport(row),
    questionPrompt: row.question_prompt,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    reporterName: row.reporter_name,
  };
}

export async function reportQuestion(
  userId: string,
  questionId: string,
  reason?: string
): Promise<QuestionReport> {
  const db = getDb();

  // Prevent the same user from stacking up multiple open reports on the
  // same question (e.g. re-flagging after retaking a quiz).
  const existingOpen = await db
    .prepare(
      "SELECT id FROM question_reports WHERE question_id = ? AND user_id = ? AND status = 'open' LIMIT 1"
    )
    .bind(questionId, userId)
    .first<{ id: string }>();
  if (existingOpen) {
    throw new Error('You already flagged this question. The creator has been notified.');
  }

  const id = generateId('report');
  const createdAt = nowIso();
  await db
    .prepare(
      "INSERT INTO question_reports (id, question_id, user_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)"
    )
    .bind(id, questionId, userId, reason ?? null, createdAt)
    .run();
  return { id, questionId, userId, reason: reason ?? null, status: 'open', createdAt };
}

/**
 * All open reports platform-wide, joined with question prompt and quiz
 * title for a readable admin moderation view.
 */
export async function listOpenReports(): Promise<QuestionReportWithContext[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT r.*, q.prompt AS question_prompt, q.quiz_id AS quiz_id,
              qz.title AS quiz_title, u.display_name AS reporter_name
       FROM question_reports r
       JOIN questions q ON q.id = r.question_id
       JOIN quizzes qz ON qz.id = q.quiz_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.status = 'open'
       ORDER BY r.created_at DESC`
    )
    .all<ReportWithContextRow>();
  return results.map(mapReportWithContext);
}

/**
 * Open reports scoped to quizzes owned by a specific creator, for the
 * creator dashboard's "Flagged questions" section. Creators only ever see
 * reports on their own content, never platform-wide reports.
 */
export async function listOpenReportsForCreator(creatorId: string): Promise<QuestionReportWithContext[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT r.*, q.prompt AS question_prompt, q.quiz_id AS quiz_id,
              qz.title AS quiz_title, u.display_name AS reporter_name
       FROM question_reports r
       JOIN questions q ON q.id = r.question_id
       JOIN quizzes qz ON qz.id = q.quiz_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.status = 'open' AND qz.creator_id = ?
       ORDER BY r.created_at DESC`
    )
    .bind(creatorId)
    .all<ReportWithContextRow>();
  return results.map(mapReportWithContext);
}

export async function getReportById(id: string): Promise<QuestionReportWithContext | null> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT r.*, q.prompt AS question_prompt, q.quiz_id AS quiz_id,
              qz.title AS quiz_title, u.display_name AS reporter_name
       FROM question_reports r
       JOIN questions q ON q.id = r.question_id
       JOIN quizzes qz ON qz.id = q.quiz_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`
    )
    .bind(id)
    .first<ReportWithContextRow>();
  return row ? mapReportWithContext(row) : null;
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<void> {
  const db = getDb();
  await db.prepare('UPDATE question_reports SET status = ? WHERE id = ?').bind(status, id).run();
}
