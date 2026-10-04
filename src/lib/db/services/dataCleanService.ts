import { getDb, nowIso } from '@/lib/db/client';
import { deleteQuiz } from '@/lib/db/services/quizService';
import type { DataCleanTarget } from '@/types';

/**
 * Admin "Data Clean": one place to see what could be tidied and remove it
 * on demand. Every target reports how many rows exist and how many a run
 * would remove, and only touches data that is safe to lose (expired,
 * resolved, stale unresolved reports, or anonymous counters). Retention
 * windows are persisted in site_settings so the admin's saved dates are
 * reused on the next visit.
 */

const CHUNK = 200;
const MAX_ROWS_PER_RUN = 2000;
const SETTINGS_KEY = 'data_clean';
const MAX_DAYS = 3650;

export type DataCleanKey =
  | 'expired_rate_limits'
  | 'guest_counters'
  | 'resolved_reports'
  | 'open_reports'
  | 'resolved_feedback'
  | 'inactive_contributors'
  | 'expired_private_quizzes';

export type DataCleanSettings = Record<DataCleanKey, number>;

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
    key: 'open_reports',
    label: 'Unresolved question reports',
    description:
      'Flagged-question reports that are still open. Only stale reports older than the saved window are removed; the question itself is never deleted.',
    defaultOlderThanDays: 180,
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

function clampDays(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DAYS, Math.max(0, Math.round(n)));
}

const DEFAULT_SETTINGS = Object.fromEntries(
  TARGETS.map((target) => [target.key, target.defaultOlderThanDays ?? 0])
) as DataCleanSettings;

async function readSavedSettings(): Promise<DataCleanSettings> {
  try {
    const db = getDb();
    const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(SETTINGS_KEY).first<{ value: string }>();
    if (!row) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(row.value) as Partial<DataCleanSettings>;
    const settings = { ...DEFAULT_SETTINGS } as DataCleanSettings;
    for (const target of TARGETS) {
      settings[target.key] = clampDays(parsed[target.key], DEFAULT_SETTINGS[target.key]);
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getDataCleanSettings(): Promise<DataCleanSettings> {
  return readSavedSettings();
}

export async function setDataCleanSettings(input: Partial<Record<DataCleanKey, unknown>>): Promise<DataCleanSettings> {
  const current = await readSavedSettings();
  const clean = { ...current } as DataCleanSettings;
  for (const target of TARGETS) {
    if (target.defaultOlderThanDays !== null && input[target.key] !== undefined) {
      clean[target.key] = clampDays(input[target.key], current[target.key]);
    }
  }

  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(SETTINGS_KEY, JSON.stringify(clean), nowIso())
    .run();
  return clean;
}

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
  if (!ids.length) return 0;
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
    case 'open_reports':
      return {
        total: await one("SELECT COUNT(*) as n FROM question_reports WHERE status = 'open'"),
        cleanable: await one(
          "SELECT COUNT(*) as n FROM question_reports WHERE status = 'open' AND created_at < ?",
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
  const saved = await readSavedSettings();
  return Promise.all(
    TARGETS.map(async (def) => {
      const days = overrides[def.key] ?? saved[def.key];
      const { total, cleanable } = await countFor(def, days);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        rowCount: total,
        cleanableCount: cleanable,
        defaultOlderThanDays: days,
      };
    })
  );
}

// ---- Cleaning ----

export async function runClean(key: DataCleanKey, olderThanDays?: number): Promise<{ deleted: number }> {
  const def = TARGETS.find((t) => t.key === key);
  if (!def) throw new Error('Unknown clean target');
  const saved = await readSavedSettings();
  const days = Math.max(0, Math.min(MAX_DAYS, Math.round(olderThanDays ?? saved[key] ?? def.defaultOlderThanDays ?? 0)));
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
    case 'resolved_reports':
    case 'open_reports': {
      const statusSql = key === 'open_reports' ? "status = 'open'" : "status IN ('reviewed', 'dismissed')";
      const { results } = await db
        .prepare(`SELECT id FROM question_reports WHERE ${statusSql} AND created_at < ? LIMIT ?`)
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

export async function runAllClean(): Promise<{ deleted: number; byKey: Record<DataCleanKey, number>; hasMore: boolean }> {
  const settings = await readSavedSettings();
  const byKey = {} as Record<DataCleanKey, number>;
  let deleted = 0;
  let hasMore = false;

  // Keep this in a single Worker/Vercel invocation. Each individual cleaner
  // remains bounded, so a large table can be safely retried from the button.
  for (const target of TARGETS) {
    const result = await runClean(target.key, settings[target.key]);
    byKey[target.key] = result.deleted;
    deleted += result.deleted;

    // A target returning its hard per-run ceiling may have more rows waiting.
    // The next press continues safely instead of letting one invocation grow
    // without a bound.
    if (result.deleted >= MAX_ROWS_PER_RUN) hasMore = true;
  }

  return { deleted, byKey, hasMore };
}
