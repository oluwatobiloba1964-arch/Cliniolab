// src/lib/db/services/flashcardAttemptService.ts
import { getDb, generateId, nowIso } from '@/lib/db/client';

/**
 * Records one completed run through a flashcard set (the user reached
 * the end of the deck). Unlike quiz_attempts there's no score, retake
 * policy, or anti-cheat concept here - every finished session is its
 * own row, which is what the "X attempts" stat on the flashcard set
 * card counts.
 */
export async function recordFlashcardAttempt(setId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('INSERT INTO flashcard_attempts (id, set_id, user_id, completed_at) VALUES (?, ?, ?, ?)')
    .bind(generateId('fcattempt'), setId, userId, nowIso())
    .run();
}

export interface FlashcardAttemptTaker {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  completedAt: string;
}

interface AttemptWithTakerRow {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  completed_at: string;
}

/**
 * Lists everyone who has completed a run through this flashcard set, most
 * recent first - the flashcard equivalent of quizService's "who attempted
 * my quiz" view on the dashboard. No score here, just who and when.
 */
export async function getAttemptsBySetWithTakers(setId: string): Promise<FlashcardAttemptTaker[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT a.*, u.display_name, u.email
       FROM flashcard_attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.set_id = ?
       ORDER BY a.completed_at DESC`
    )
    .bind(setId)
    .all<AttemptWithTakerRow>();

  return results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    completedAt: row.completed_at,
  }));
}
