import { getDb, nowIso } from '@/lib/db/client';

/**
 * Data retention: keeps D1 (5GB free tier) from growing without bound.
 *
 * What is pruned, and why it is safe:
 *  - attempt_answers: per-question detail of a recorded attempt. Nothing
 *    scoring-related reads it. The leaderboard, dashboard score chart, and
 *    "already attempted" gate all read quiz_attempts, which is NEVER pruned.
 *    Its only readers are the "Retake missed" feature (falls back to the
 *    full question set when there is nothing to filter by) and the
 *    question-delete safety check in updateQuiz (pruning only makes more
 *    questions deletable).
 *  - email_log: only the send-once types are ever read back
 *    (hasEmailBeenSent for welcome + certificate_issued), so those are kept.
 *  - banner_stats: optional very-old daily counters.
 *
 * All limits are admin-configurable and stored in site_settings.
 */

export interface RetentionSettings {
  /** Delete attempt_answers whose attempt is older than this many days. 0 = never delete. */
  attemptAnswersDays: number;
  /** Delete non-send-once email_log rows older than this many days. 0 = never delete. */
  emailLogDays: number;
  /** Delete banner_stats daily rows older than this many days. 0 = never delete. */
  bannerStatsDays: number;
}

export const DEFAULT_RETENTION: RetentionSettings = {
  attemptAnswersDays: 60,
  emailLogDays: 365,
  bannerStatsDays: 0, // banner history is small and sponsor reports want it; off by default
};

const SETTINGS_KEY = 'data_retention';
const MIN_DAYS = 0; // no floor; 0 already means "never delete" via the explicit check above
const MAX_DAYS = 3650;

/** Email types hasEmailBeenSent reads back; deleting these would cause duplicate sends. */
const KEEP_EMAIL_TYPES = ['welcome', 'certificate_issued'] as const;

/**
 * Rows deleted per statement. D1 caps a single query's bound parameters and
 * runtime, and one giant DELETE can time out. Small repeated batches are
 * safe to interrupt and simply resume next run.
 */
const BATCH_SIZE = 500;
/** Hard ceiling per run so one invocation stays well inside a Worker's time budget. */
const MAX_BATCHES_PER_TABLE = 40;

function clampDays(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded === 0) return 0; // explicit "never"
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, rounded));
}

export async function getRetentionSettings(): Promise<RetentionSettings> {
  const db = getDb();
  const row = await db
    .prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind(SETTINGS_KEY)
    .first<{ value: string }>();
  if (!row) return DEFAULT_RETENTION;
  try {
    const parsed = JSON.parse(row.value) as Partial<RetentionSettings>;
    return {
      attemptAnswersDays: clampDays(parsed.attemptAnswersDays, DEFAULT_RETENTION.attemptAnswersDays),
      emailLogDays: clampDays(parsed.emailLogDays, DEFAULT_RETENTION.emailLogDays),
      bannerStatsDays: clampDays(parsed.bannerStatsDays, DEFAULT_RETENTION.bannerStatsDays),
    };
  } catch {
    return DEFAULT_RETENTION;
  }
}

export async function setRetentionSettings(settings: RetentionSettings): Promise<RetentionSettings> {
  const clean: RetentionSettings = {
    attemptAnswersDays: clampDays(settings.attemptAnswersDays, DEFAULT_RETENTION.attemptAnswersDays),
    emailLogDays: clampDays(settings.emailLogDays, DEFAULT_RETENTION.emailLogDays),
    bannerStatsDays: clampDays(settings.bannerStatsDays, DEFAULT_RETENTION.bannerStatsDays),
  };
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

/** ISO cutoff timestamp for "older than N days ago". Matches nowIso() format so string comparison is correct. */
function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Runs one bounded DELETE repeatedly until it removes nothing or the batch ceiling is hit. */
async function deleteInBatches(sql: string, ...bindings: unknown[]): Promise<{ deleted: number; complete: boolean }> {
  const db = getDb();
  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES_PER_TABLE; i++) {
    const res = await db
      .prepare(sql)
      .bind(...bindings, BATCH_SIZE)
      .run();
    const changes = res.meta?.changes ?? 0;
    deleted += changes;
    if (changes < BATCH_SIZE) return { deleted, complete: true };
  }
  // Hit the ceiling with rows possibly remaining; the next run continues.
  return { deleted, complete: false };
}

export interface RetentionRunResult {
  settings: RetentionSettings;
  attemptAnswersDeleted: number;
  emailLogDeleted: number;
  bannerStatsDeleted: number;
  /** true when every table was fully caught up; false if a batch ceiling was hit and more remains. */
  complete: boolean;
}

/**
 * Purges data past each configured retention window. Idempotent and safe to
 * run as often as you like; a table set to 0 days is skipped entirely.
 */
export async function runRetention(): Promise<RetentionRunResult> {
  const settings = await getRetentionSettings();
  const result: RetentionRunResult = {
    settings,
    attemptAnswersDeleted: 0,
    emailLogDeleted: 0,
    bannerStatsDeleted: 0,
    complete: true,
  };

  if (settings.attemptAnswersDays > 0) {
    // attempt_answers has no timestamp of its own, so age comes from the
    // parent attempt. quiz_attempts is left untouched.
    const r = await deleteInBatches(
      `DELETE FROM attempt_answers WHERE id IN (
         SELECT aa.id FROM attempt_answers aa
         JOIN quiz_attempts qa ON qa.id = aa.attempt_id
         WHERE qa.started_at < ?
         LIMIT ?
       )`,
      cutoffIso(settings.attemptAnswersDays)
    );
    result.attemptAnswersDeleted = r.deleted;
    result.complete &&= r.complete;
  }

  if (settings.emailLogDays > 0) {
    const keepPlaceholders = KEEP_EMAIL_TYPES.map(() => '?').join(', ');
    const r = await deleteInBatches(
      `DELETE FROM email_log WHERE id IN (
         SELECT id FROM email_log
         WHERE sent_at < ? AND email_type NOT IN (${keepPlaceholders})
         LIMIT ?
       )`,
      cutoffIso(settings.emailLogDays),
      ...KEEP_EMAIL_TYPES
    );
    result.emailLogDeleted = r.deleted;
    result.complete &&= r.complete;
  }

  if (settings.bannerStatsDays > 0) {
    // banner_stats.day is YYYY-MM-DD, so compare against a date, not a timestamp.
    const cutoffDay = cutoffIso(settings.bannerStatsDays).slice(0, 10);
    const r = await deleteInBatches(
      `DELETE FROM banner_stats WHERE rowid IN (
         SELECT rowid FROM banner_stats WHERE day < ? LIMIT ?
       )`,
      cutoffDay
    );
    result.bannerStatsDeleted = r.deleted;
    result.complete &&= r.complete;
  }

  return result;
}

export interface DataUsage {
  attemptAnswers: number;
  attemptAnswersEligible: number;
  quizAttempts: number;
  emailLog: number;
  emailLogEligible: number;
  bannerStatsRows: number;
  legacyBannerEvents: number | null;
}

async function countOne(sql: string, ...bindings: unknown[]): Promise<number> {
  const db = getDb();
  const row = await db.prepare(sql).bind(...bindings).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Row counts for the admin Storage page: how many rows exist and how many
 * the current settings would remove on the next run. Counts, not bytes -
 * D1 does not expose per-table size from SQL, so use `wrangler d1 info`
 * for total database size.
 */
export async function getDataUsage(): Promise<DataUsage> {
  const settings = await getRetentionSettings();
  const keepPlaceholders = KEEP_EMAIL_TYPES.map(() => '?').join(', ');

  const [attemptAnswers, quizAttempts, emailLog, bannerStatsRows] = await Promise.all([
    countOne('SELECT COUNT(*) AS n FROM attempt_answers'),
    countOne('SELECT COUNT(*) AS n FROM quiz_attempts'),
    countOne('SELECT COUNT(*) AS n FROM email_log'),
    countOne('SELECT COUNT(*) AS n FROM banner_stats'),
  ]);

  const attemptAnswersEligible =
    settings.attemptAnswersDays > 0
      ? await countOne(
          `SELECT COUNT(*) AS n FROM attempt_answers aa
           JOIN quiz_attempts qa ON qa.id = aa.attempt_id
           WHERE qa.started_at < ?`,
          cutoffIso(settings.attemptAnswersDays)
        )
      : 0;

  const emailLogEligible =
    settings.emailLogDays > 0
      ? await countOne(
          `SELECT COUNT(*) AS n FROM email_log WHERE sent_at < ? AND email_type NOT IN (${keepPlaceholders})`,
          cutoffIso(settings.emailLogDays),
          ...KEEP_EMAIL_TYPES
        )
      : 0;

  // The legacy event log may already be dropped after the migration cleanup.
  let legacyBannerEvents: number | null = null;
  try {
    legacyBannerEvents = await countOne('SELECT COUNT(*) AS n FROM banner_events');
  } catch {
    legacyBannerEvents = null;
  }

  return {
    attemptAnswers,
    attemptAnswersEligible,
    quizAttempts,
    emailLog,
    emailLogEligible,
    bannerStatsRows,
    legacyBannerEvents,
  };
}
