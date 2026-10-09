import { getDb, nowIso } from '@/lib/db/client';
import type { AppUser, UserDashboardStats, UserRole } from '@/types';

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  email_quiz_results: number;
  email_newsletter: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  creator_balance_kobo: number;
  payout_bank_code: string | null;
  payout_bank_name: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  contact_phone: string | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as UserRole,
    emailQuizResults: row.email_quiz_results === 1,
    emailNewsletter: row.email_newsletter === 1,
    currentStreakDays: row.current_streak_days,
    longestStreakDays: row.longest_streak_days,
    lastActivityDate: row.last_activity_date,
    creatorBalanceKobo: row.creator_balance_kobo,
    payoutBankCode: row.payout_bank_code,
    payoutBankName: row.payout_bank_name,
    payoutAccountNumber: row.payout_account_number,
    payoutAccountName: row.payout_account_name,
    contactPhone: row.contact_phone,
    bio: row.bio,
    avatarPath: row.avatar_path,
    createdAt: row.created_at,
  };
}

/**
 * Ensures a users row exists for a Supabase-authenticated user (upsert on
 * first login). This is what links Supabase Auth identities to D1 data.
 */
export async function ensureUserRecord(
  id: string,
  email: string,
  displayName?: string
): Promise<AppUser> {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (existing) return mapUser(existing);

  const createdAt = nowIso();
  await db
    .prepare(
      'INSERT INTO users (id, email, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, email, displayName ?? null, 'user', createdAt)
    .run();
  return {
    id,
    email,
    displayName: displayName ?? null,
    role: 'user',
    emailQuizResults: true,
    emailNewsletter: true,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastActivityDate: null,
    creatorBalanceKobo: 0,
    payoutBankCode: null,
    payoutBankName: null,
    payoutAccountNumber: null,
    payoutAccountName: null,
    contactPhone: null,
    bio: null,
    avatarPath: null,
    createdAt,
  };
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return row ? mapUser(row) : null;
}

export async function setUserRole(id: string, role: UserRole): Promise<void> {
  const db = getDb();
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
}

export async function adminListUsers(): Promise<AppUser[]> {
  const db = getDb();
  const { results } = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all<UserRow>();
  return results.map(mapUser);
}

export async function adminListUsersPage(
  page: number,
  pageSize: number
): Promise<{ users: AppUser[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const [{ results }, countRow] = await Promise.all([
    db
      .prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(pageSize, offset)
      .all<UserRow>(),
    db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
  ]);
  return { users: results.map(mapUser), total: countRow?.count ?? 0 };
}

/**
 * Saves a creator's bank details for future payouts, entered as free text
 * with no provider verification. Since there's no verified bankCode, these
 * creators are routed to the "Mark paid manually" admin action instead of
 * Flutterwave auto-transfer (see admin payout-requests route, which
 * requires payoutBankCode before attempting a transfer).
 */
export async function savePayoutDetails(
  userId: string,
  details: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `UPDATE users SET
        payout_bank_name = ?,
        payout_account_number = ?,
        payout_account_name = ?
       WHERE id = ?`
    )
    .bind(details.bankName, details.accountNumber, details.accountName, userId)
    .run();
}

/** Adds (or subtracts, with a negative delta) from a creator's withdrawable balance. */
export async function adjustCreatorBalance(userId: string, deltaKobo: number): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE users SET creator_balance_kobo = creator_balance_kobo + ? WHERE id = ?')
    .bind(deltaKobo, userId)
    .run();
}

/**
 * Saves (or clears, with null) a creator's contact number. Shown on the
 * share text of every public quiz they create/have created — fetched live
 * from the users table on each share, so an update here applies
 * immediately to all of their existing quizzes with no per-quiz edits.
 */
export async function updateContactPhone(userId: string, contactPhone: string | null): Promise<void> {
  const db = getDb();
  await db.prepare('UPDATE users SET contact_phone = ? WHERE id = ?').bind(contactPhone, userId).run();
}

/**
 * Updates the fields shown on a creator's public profile page
 * (/creator/[userId]) - display name, bio, avatar. Each field is
 * only touched when provided, so a caller can update just one (e.g.
 * an avatar-only upload) without clobbering the others.
 */
export async function updateProfile(
  userId: string,
  fields: { displayName?: string | null; bio?: string | null; avatarPath?: string | null }
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | null)[] = [];
  if ('displayName' in fields) {
    sets.push('display_name = ?');
    values.push(fields.displayName ?? null);
  }
  if ('bio' in fields) {
    sets.push('bio = ?');
    values.push(fields.bio ?? null);
  }
  if ('avatarPath' in fields) {
    sets.push('avatar_path = ?');
    values.push(fields.avatarPath ?? null);
  }
  if (sets.length === 0) return;
  values.push(userId);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

/**
 * Public creator profile data for /creator/[userId] - deliberately a
 * narrow projection (no email, payout details, streaks, etc), since
 * this is served to anyone with the link, not just the creator
 * themselves. Returns null for an unknown id so the route can 404.
 */
export async function getPublicCreatorProfile(userId: string): Promise<{
  id: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  createdAt: string;
} | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT id, display_name, bio, avatar_path, created_at FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; display_name: string | null; bio: string | null; avatar_path: string | null; created_at: string }>();
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    bio: row.bio,
    avatarPath: row.avatar_path,
    createdAt: row.created_at,
  };
}

export async function updateEmailPreferences(
  userId: string,
  prefs: { emailQuizResults?: boolean; emailNewsletter?: boolean }
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (prefs.emailQuizResults !== undefined) {
    fields.push('email_quiz_results = ?');
    values.push(prefs.emailQuizResults ? 1 : 0);
  }
  if (prefs.emailNewsletter !== undefined) {
    fields.push('email_newsletter = ?');
    values.push(prefs.emailNewsletter ? 1 : 0);
  }
  if (fields.length === 0) return;
  values.push(userId);
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

/**
 * Updates a user's streak based on today's activity. Call this once per
 * quiz/exam attempt. Logic:
 * - If last activity was yesterday, increment the streak.
 * - If last activity was today already, no change (already counted).
 * - If last activity was earlier than yesterday (or never), reset to 1.
 */
export async function recordActivityForStreak(userId: string): Promise<void> {
  const db = getDb();
  const user = await db
    .prepare('SELECT current_streak_days, longest_streak_days, last_activity_date FROM users WHERE id = ?')
    .bind(userId)
    .first<{ current_streak_days: number; longest_streak_days: number; last_activity_date: string | null }>();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (user.last_activity_date === today) return; // already recorded today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = user.last_activity_date === yesterday ? user.current_streak_days + 1 : 1;
  const newLongest = Math.max(newStreak, user.longest_streak_days);

  await db
    .prepare(
      'UPDATE users SET current_streak_days = ?, longest_streak_days = ?, last_activity_date = ? WHERE id = ?'
    )
    .bind(newStreak, newLongest, today, userId)
    .run();
}

/** Users who haven't been active in exactly N days (for the inactivity nudge cron). */
export async function listUsersInactiveForDays(days: number): Promise<AppUser[]> {
  const db = getDb();
  const targetDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { results } = await db
    .prepare('SELECT * FROM users WHERE last_activity_date = ?')
    .bind(targetDate)
    .all<UserRow>();
  return results.map(mapUser);
}

export async function getUserDashboardStats(userId: string): Promise<UserDashboardStats> {
  const db = getDb();

  const summary = await db
    .prepare(
      `SELECT
        COUNT(*) as total_attempts,
        AVG(CAST(score AS REAL) / total_questions * 100) as avg_percentage,
        MAX(CAST(score AS REAL) / total_questions * 100) as best_percentage
      FROM quiz_attempts WHERE user_id = ?`
    )
    .bind(userId)
    .first<{ total_attempts: number; avg_percentage: number | null; best_percentage: number | null }>();

  const quizzesCreated = await db
    .prepare('SELECT COUNT(*) as count FROM quizzes WHERE creator_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  const certificatesEarned = await db
    .prepare('SELECT COUNT(*) as count FROM certificates WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  const { results: history } = await db
    .prepare(
      `SELECT a.completed_at as date,
              (CAST(a.score AS REAL) / a.total_questions * 100) as percentage,
              q.title as quiz_title
       FROM quiz_attempts a
       JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.user_id = ? AND a.completed_at IS NOT NULL
       ORDER BY a.completed_at ASC`
    )
    .bind(userId)
    .all<{ date: string; percentage: number; quiz_title: string }>();

  return {
    totalAttempts: summary?.total_attempts ?? 0,
    averagePercentage: summary?.avg_percentage ?? 0,
    bestPercentage: summary?.best_percentage ?? 0,
    quizzesCreated: quizzesCreated?.count ?? 0,
    certificatesEarned: certificatesEarned?.count ?? 0,
    scoreHistory: history.map((h) => ({ date: h.date, percentage: h.percentage, quizTitle: h.quiz_title })),
  };
}

/**
 * Well-known id for the placeholder account that quizzes/posts/resources
 * get reassigned to when their original creator is deleted (see
 * deleteUserCompletely below). Kept live with role 'user' and no login
 * capability of its own (no matching Supabase Auth account), display name
 * "User" - never surfaced as if it were the original person.
 */
export const DELETED_USER_PLACEHOLDER_ID = 'placeholder-deleted-user';

async function ensurePlaceholderUserRecord(): Promise<void> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(DELETED_USER_PLACEHOLDER_ID)
    .first<{ id: string }>();
  if (existing) return;

  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, role, created_at)
       VALUES (?, ?, ?, 'user', ?)`
    )
    .bind(
      DELETED_USER_PLACEHOLDER_ID,
      'deleted-user-placeholder@cliniolab.internal',
      'User',
      nowIso()
    )
    .run();
}

/**
 * Permanently deletes a user: their own personal activity (attempts,
 * comments, bookmarks, etc.) is deleted outright, while content they
 * created that other users have engaged with (quizzes, blog posts,
 * resources, abbreviations, scholar features) is kept live but reassigned
 * to a placeholder "User" account, so deleting one person's account
 * doesn't erase other students' attempt history/comments on quizzes they
 * happened to have made.
 *
 * Refuses to run if the user has any unresolved money owed to them
 * (a pending/processing payout request, or a positive withdrawable
 * balance) - that must be settled first, outside this flow.
 *
 * Does NOT touch Supabase Auth - the caller (the admin API route) is
 * responsible for calling supabase.auth.admin.deleteUser() as well, since
 * that's a separate system this service has no access to.
 */
export async function deleteUserCompletely(userId: string): Promise<void> {
  const db = getDb();

  const user = await db
    .prepare('SELECT creator_balance_kobo FROM users WHERE id = ?')
    .bind(userId)
    .first<{ creator_balance_kobo: number }>();
  if (!user) return; // already gone; nothing to do

  if (user.creator_balance_kobo > 0) {
    throw new Error(
      'This user has an unpaid withdrawable balance. Settle or zero it out via a payout before deleting.'
    );
  }

  const pendingPayout = await db
    .prepare(
      `SELECT id FROM payout_requests WHERE creator_id = ? AND status IN ('pending', 'processing') LIMIT 1`
    )
    .bind(userId)
    .first<{ id: string }>();
  if (pendingPayout) {
    throw new Error(
      'This user has a pending or processing payout request. Settle it (mark paid or failed) before deleting.'
    );
  }

  await ensurePlaceholderUserRecord();
  const placeholder = DELETED_USER_PLACEHOLDER_ID;

  // FIX (Vercel Hobby duration budget) — src/lib/db/services/userService.ts
  // This whole deletion flow was ~20 sequential `await db.prepare(...).run()`
  // calls, one after another, plus two real N+1 loops further down (one
  // DELETE per quiz_attempts row, one DELETE per comments row). On the
  // D1-HTTP path every one of those is a separate network round trip, so a
  // single account deletion could be dozens of round trips end-to-end.
  // Rare action (account deletion), but still worth fixing properly rather
  // than leaving the worst-case path in a "fix everything" pass.
  //
  // --- Reassign content the user created, so other users' activity on it survives ---
  // These 7 statements touch different tables and none depend on each
  // other's result, so they can all run concurrently instead of serially.
  await Promise.all([
    db.prepare('UPDATE quizzes SET creator_id = ? WHERE creator_id = ?').bind(placeholder, userId).run(),
    db.prepare('UPDATE blog_posts SET author_id = ? WHERE author_id = ?').bind(placeholder, userId).run(),
    db.prepare('UPDATE resources SET uploaded_by = ? WHERE uploaded_by = ?').bind(placeholder, userId).run(),
    db.prepare('UPDATE medical_abbreviations SET created_by = ? WHERE created_by = ?').bind(placeholder, userId).run(),
    db.prepare('UPDATE scholars_of_the_day SET created_by = ? WHERE created_by = ?').bind(placeholder, userId).run(),
    db
      .prepare('UPDATE scholars_of_the_day SET student_user_id = NULL WHERE student_user_id = ?')
      .bind(userId)
      .run(),
    db.prepare('UPDATE resource_purchases SET confirmed_by = ? WHERE confirmed_by = ?').bind(placeholder, userId).run(),
  ]);

  // --- Delete the user's own personal activity outright ---

  // attempt_answers reference quiz_attempts by attempt_id, not user_id
  // directly. Was: SELECT the attempt ids, then DELETE once per id in a
  // loop. Now: delete by subquery in one statement — no per-row round
  // trip needed at all, and no intermediate SELECT either.
  await db
    .prepare('DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = ?)')
    .bind(userId)
    .run();
  await db.prepare('DELETE FROM quiz_attempts WHERE user_id = ?').bind(userId).run();

  await db.prepare('DELETE FROM certificates WHERE user_id = ?').bind(userId).run();

  // comment_reactions reference comments by comment_id, so both directions
  // need clearing before the comments themselves can go: reactions BY this
  // user on any comment, and reactions made BY OTHERS on this user's own
  // comments (which would otherwise dangle once those comments are
  // deleted). Was: SELECT comment ids, then DELETE once per id in a loop.
  // Now: same subquery-delete pattern, one statement instead of N+1.
  await db.prepare('DELETE FROM comment_reactions WHERE user_id = ?').bind(userId).run();
  await db
    .prepare('DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM comments WHERE user_id = ?)')
    .bind(userId)
    .run();
  await db.prepare('DELETE FROM comments WHERE user_id = ?').bind(userId).run();

  // These 7 deletes are likewise independent of each other.
  await Promise.all([
    db.prepare('DELETE FROM question_reports WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM bookmarks WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM feedback WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM email_log WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM resource_purchases WHERE user_id = ?').bind(userId).run(),
    db.prepare('DELETE FROM quiz_purchases WHERE buyer_id = ?').bind(userId).run(),
  ]);

  // The user's own payout_requests were already confirmed clear of
  // pending/processing above; any resolved (paid/failed) ones are
  // historical financial records worth keeping for the platform's own
  // books, so they're reassigned to the placeholder rather than deleted.
  // These 2 are independent of each other too.
  await Promise.all([
    db.prepare('UPDATE payout_requests SET creator_id = ? WHERE creator_id = ?').bind(placeholder, userId).run(),
    db.prepare('UPDATE payout_requests SET actioned_by = ? WHERE actioned_by = ?').bind(placeholder, userId).run(),
  ]);

  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
