import { getDb } from '@/lib/db/client';
import { deleteQuiz } from '@/lib/db/services/quizService';
import type { DataCleanTarget } from '@/types';

/**
 * Admin "Data Clean": one place to see what could be tidied and remove it
 * on demand. Every target reports how many rows exist and how many a run
 * would remove, and only touches data that is safe to lose (expired,
 * resolved, or anonymous counters). Retention for attempt answers, email
 * logs and banner stats stays on the Storage & Cleanup page.
 */

const CHUNK = 200;
const MAX_ROWS_PER_RUN = 2000;

export type DataCleanKey =
  | 'expired_rate_limits'
  | 'guest_counters'
  | 'resolved_reports'
  | 'resolved_feedback'
  | 'inactive_contributors'
  | 'expired_private_quizzes';

interface TargetDef {
  key: DataCleanKey;
  label: string;
  description: string;
  /** null = no age input (acts on everything eligible right now) */
  defaultOlderThanDays: number | null;
}

const TARGETS: TargetDef[] = [
  {
    key: 'expired_rate_limits',
    label: 'Expired throttle rows',
    description:
      'Short-lived request counters (login attempts, guest completion throttle). Rows past their expiry are safe to remove.',
    defaultOlderThanDays: null,
  },
  {
    key: 'guest_counters',
    label: 'Guest completion counters',
    description:
      'Anonymous "finished by guests" totals on Guest Practice items. Cleaning resets them to zero. No personal data is stored here.',
    defaultOlderThanDays: null,
  },
  {
    key: 'resolved_reports',
    label: 'Resolved question reports',
    description: 'Flagged-question reports already reviewed or dismissed.',
    defaultOlderThanDays: 60,
  },
  {
    key: 'resolved_feedback',
    label: 'Resolved feedback',
    description: 'Feedback messages marked resolved.',
    defaultOlderThanDays: 90,
  },
  {
    key: 'inactive_contributors',
    label: 'Unused inactive contributors',
    description: 'Contributors switched off and not credited on any post. Post bylines are unaffected.',
    defaultOlderThanDays: 30,
  },
  {
    key: 'expired_private_quizzes',
    label: 'Expired private quizzes with no attempts',
    description:
      'Private quizzes whose share link expired, that nobody ever attempted. Deletes the quiz and its questions.',
    defaultOlderThanDays: 30,
  },
];

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** SQLite datetime('now') style, used by columns with that default. */
function cutoffSql(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

async function one(sql: string, ...bindings: unknown[]): Promise<number> {
  try {
    const db = getDb();
    const row = await db.prepare(sql).bind(...bindings).first<{ n: number }>();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

function placeholders(n: number): string {
  return Array(n).fill('?').join(', ');
}

async function deleteByIds(table: string, ids: string[]): Promise<number> {
  const db = getDb();
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const res = await db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders(part.length)})`).bind(...part).run();
    deleted += res.meta?.changes ?? part.length;
  }
  return deleted;
}

// ---- Counting ----

async function countFor(def: TargetDef, days: number): Promise<{ total: number; cleanable: number }> {
  switch (def.key) {
    case 'expired_rate_limits': {
      const nowSec = Math.floor(Date.now() / 1000);
      return {
        total: await one('SELECT COUNT(*) as n FROM rate_limits'),
        cleanable: await one('SELECT COUNT(*) as n FROM rate_limits WHERE expires_at < ?', nowSec),
      };
    }
    case 'guest_counters': {
      const q = await one('SELECT COALESCE(SUM(guest_attempt_count + guest_study_count), 0) as n FROM quizzes');
      const f = await one('SELECT COALESCE(SUM(guest_attempt_count), 0) as n FROM flashcard_sets');
      return { total: q + f, cleanable: q + f };
    }
    case 'resolved_reports':
      return {
        total: await one('SELECT COUNT(*) as n FROM question_reports'),
        cleanable: await one(
          "SELECT COUNT(*) as n FROM question_reports WHERE status IN ('reviewed', 'dismissed') AND created_at < ?",
          cutoffSql(days)
        ),
      };
    case 'resolved_feedback':
      return {
        total: await one('SELECT COUNT(*) as n FROM feedback'),
        cleanable: await one("SELECT COUNT(*) as n FROM feedback WHERE status = 'resolved' AND created_at < ?", cutoffSql(days)),
      };
    case 'inactive_contributors':
      return {
        total: await one('SELECT COUNT(*) as n FROM contributors'),
        cleanable: await one(
          `SELECT COUNT(*) as n FROM contributors c
           WHERE c.is_active = 0 AND c.updated_at < ?
             AND NOT EXISTS (SELECT 1 FROM blog_posts b WHERE b.author_contributor_id = c.id OR b.reviewer_contributor_id = c.id)`,
          cutoffSql(days)
        ),
      };
    case 'expired_private_quizzes':
      return {
        total: await one("SELECT COUNT(*) as n FROM quizzes WHERE visibility = 'private'"),
        cleanable: await one(
          `SELECT COUNT(*) as n FROM quizzes q
           WHERE q.visibility = 'private' AND q.link_expires_at IS NOT NULL AND q.link_expires_at < ?
             AND NOT EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.quiz_id = q.id)
             AND NOT EXISTS (SELECT 1 FROM study_attempts s WHERE s.quiz_id = q.id)`,
          cutoffIso(days)
        ),
      };
  }
}

export async function listTargets(overrides: Partial<Record<DataCleanKey, number>> = {}): Promise<DataCleanTarget[]> {
  const out: DataCleanTarget[] = [];
  for (const def of TARGETS) {
    const days = overrides[def.key] ?? def.defaultOlderThanDays ?? 0;
    const { total, cleanable } = await countFor(def, days);
    out.push({
      key: def.key,
      label: def.label,
      description: def.description,
      rowCount: total,
      cleanableCount: cleanable,
      defaultOlderThanDays: def.defaultOlderThanDays ?? 0,
    });
  }
  return out;
}

// ---- Cleaning ----

export async function runClean(key: DataCleanKey, olderThanDays?: number): Promise<{ deleted: number }> {
  const def = TARGETS.find((t) => t.key === key);
  if (!def) throw new Error('Unknown clean target');
  const days = Math.max(0, Math.min(3650, Math.round(olderThanDays ?? def.defaultOlderThanDays ?? 0)));
  const db = getDb();

  switch (key) {
    case 'expired_rate_limits': {
      const nowSec = Math.floor(Date.now() / 1000);
      const res = await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowSec).run();
      return { deleted: res.meta?.changes ?? 0 };
    }
    case 'guest_counters': {
      const before = await countFor(def, days);
      await db.batch([
        db.prepare('UPDATE quizzes SET guest_attempt_count = 0, guest_study_count = 0'),
        db.prepare('UPDATE flashcard_sets SET guest_attempt_count = 0'),
      ]);
      return { deleted: before.cleanable };
    }
    case 'resolved_reports': {
      const { results } = await db
        .prepare("SELECT id FROM question_reports WHERE status IN ('reviewed', 'dismissed') AND created_at < ? LIMIT ?")
        .bind(cutoffSql(days), MAX_ROWS_PER_RUN)
        .all<{ id: string }>();
      return { deleted: await deleteByIds('question_reports', results.map((r) => r.id)) };
    }
    case 'resolved_feedback': {
      const { results } = await db
        .prepare("SELECT id FROM feedback WHERE status = 'resolved' AND created_at < ? LIMIT ?")
        .bind(cutoffSql(days), MAX_ROWS_PER_RUN)
        .all<{ id: string }>();
      return { deleted: await deleteByIds('feedback', results.map((r) => r.id)) };
    }
    case 'inactive_contributors': {
      const { results } = await db
        .prepare(
          `SELECT c.id FROM contributors c
           WHERE c.is_active = 0 AND c.updated_at < ?
             AND NOT EXISTS (SELECT 1 FROM blog_posts b WHERE b.author_contributor_id = c.id OR b.reviewer_contributor_id = c.id)
           LIMIT ?`
        )
        .bind(cutoffSql(days), MAX_ROWS_PER_RUN)
        .all<{ id: string }>();
      return { deleted: await deleteByIds('contributors', results.map((r) => r.id)) };
    }
    case 'expired_private_quizzes': {
      const { results } = await db
        .prepare(
          `SELECT q.id FROM quizzes q
           WHERE q.visibility = 'private' AND q.link_expires_at IS NOT NULL AND q.link_expires_at < ?
             AND NOT EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.quiz_id = q.id)
             AND NOT EXISTS (SELECT 1 FROM study_attempts s WHERE s.quiz_id = q.id)
           LIMIT 100`
        )
        .bind(cutoffIso(days))
        .all<{ id: string }>();
      let deleted = 0;
      for (const row of results) {
        try {
          await deleteQuiz(row.id);
          deleted++;
        } catch {
          // Skip a quiz that still has references; the admin can retry.
        }
      }
      return { deleted };
    }
  }
}
