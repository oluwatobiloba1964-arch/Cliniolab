import { getDb } from '@/lib/db/client';
import type { Flashcard, Quiz, QuizQuestion } from '@/types';
import { getQuizById, getQuizQuestions } from '@/lib/db/services/quizService';
import { getFlashcardSetById, getFlashcardsBySetId } from '@/lib/db/services/flashcardService';

/**
 * Guest Practice data access.
 *
 * Guest items are quizzes / study-mode quizzes / flashcard sets whose
 * visibility is 'guest'. They are free, published, and open to visitors
 * without an account. The ONLY write this service performs is an anonymous
 * +1 on guest_attempt_count / guest_study_count when a guest finishes an
 * item. No user id, session id, answers or scores are ever stored.
 */

export type GuestItemKind = 'quiz' | 'study' | 'flashcards';

export interface GuestItem {
  kind: GuestItemKind;
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  itemCount: number;
  categoryName: string;
  subcategoryName: string;
  completions: number;
  updatedAt: string;
  href: string;
}

interface GuestQuizRow {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  difficulty: string;
  updated_at: string;
  guest_attempt_count: number;
  guest_study_count: number;
  question_count: number;
  category_name: string;
  subcategory_name: string;
}

interface GuestSetRow {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  guest_attempt_count: number;
  card_count: number;
  category_name: string;
  subcategory_name: string;
}

/** Newest first. Mixed list of guest quizzes, study quizzes and flashcard sets. */
export async function listGuestItems(opts: { limit?: number; offset?: number; kind?: GuestItemKind } = {}): Promise<GuestItem[]> {
  const db = getDb();
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  const offset = Math.max(0, opts.offset ?? 0);
  const kind = opts.kind;

  // Pull enough of each source to merge and slice correctly.
  const fetchCount = limit + offset;

  const wantQuizzes = !kind || kind === 'quiz' || kind === 'study';
  const wantSets = !kind || kind === 'flashcards';

  const items: GuestItem[] = [];

  if (wantQuizzes) {
    const modeClause = kind === 'study' ? "AND q.mode = 'study'" : kind === 'quiz' ? "AND q.mode != 'study'" : '';
    const { results } = await db
      .prepare(
        `SELECT q.id, q.title, q.description, q.mode, q.difficulty, q.updated_at,
                q.guest_attempt_count, q.guest_study_count,
                (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
                c.name as category_name, s.name as subcategory_name
         FROM quizzes q
         JOIN subcategories s ON s.id = q.subcategory_id
         JOIN categories c ON c.id = s.category_id
         WHERE q.visibility = 'guest' AND q.status = 'published' AND q.pricing = 'free' ${modeClause}
         ORDER BY q.updated_at DESC
         LIMIT ?`
      )
      .bind(fetchCount)
      .all<GuestQuizRow>();
    for (const r of results) {
      if (r.question_count === 0) continue;
      const isStudy = r.mode === 'study';
      items.push({
        kind: isStudy ? 'study' : 'quiz',
        id: r.id,
        title: r.title,
        description: r.description,
        difficulty: r.difficulty,
        itemCount: r.question_count,
        categoryName: r.category_name,
        subcategoryName: r.subcategory_name,
        completions: isStudy ? r.guest_study_count : r.guest_attempt_count,
        updatedAt: r.updated_at,
        href: `/guest/quiz/${r.id}`,
      });
    }
  }

  if (wantSets) {
    const { results } = await db
      .prepare(
        `SELECT fs.id, fs.title, fs.description, fs.updated_at, fs.guest_attempt_count,
                (SELECT COUNT(*) FROM flashcards WHERE set_id = fs.id) as card_count,
                c.name as category_name, s.name as subcategory_name
         FROM flashcard_sets fs
         JOIN subcategories s ON s.id = fs.subcategory_id
         JOIN categories c ON c.id = s.category_id
         WHERE fs.visibility = 'guest' AND fs.status = 'published' AND fs.pricing = 'free'
         ORDER BY fs.updated_at DESC
         LIMIT ?`
      )
      .bind(fetchCount)
      .all<GuestSetRow>();
    for (const r of results) {
      if (r.card_count === 0) continue;
      items.push({
        kind: 'flashcards',
        id: r.id,
        title: r.title,
        description: r.description,
        difficulty: null,
        itemCount: r.card_count,
        categoryName: r.category_name,
        subcategoryName: r.subcategory_name,
        completions: r.guest_attempt_count,
        updatedAt: r.updated_at,
        href: `/guest/flashcards/${r.id}`,
      });
    }
  }

  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return items.slice(offset, offset + limit);
}

export async function countGuestItems(): Promise<number> {
  const db = getDb();
  const [q, f] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) as c FROM quizzes WHERE visibility = 'guest' AND status = 'published' AND pricing = 'free'")
      .first<{ c: number }>(),
    db
      .prepare("SELECT COUNT(*) as c FROM flashcard_sets WHERE visibility = 'guest' AND status = 'published' AND pricing = 'free'")
      .first<{ c: number }>(),
  ]);
  return (q?.c ?? 0) + (f?.c ?? 0);
}

/** Returns the quiz only if it is a published, free Guest quiz. */
export async function getGuestQuiz(quizId: string): Promise<Quiz | null> {
  const quiz = await getQuizById(quizId);
  if (!quiz) return null;
  if (quiz.visibility !== 'guest' || quiz.status !== 'published' || quiz.pricing !== 'free') return null;
  return quiz;
}

export async function getGuestQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  return getQuizQuestions(quizId);
}

export async function getGuestFlashcardSet(setId: string) {
  const set = await getFlashcardSetById(setId);
  if (!set) return null;
  if (set.visibility !== 'guest' || set.status !== 'published' || set.pricing !== 'free') return null;
  return set;
}

export async function getGuestFlashcards(setId: string): Promise<Flashcard[]> {
  return getFlashcardsBySetId(setId);
}

/** Anonymous +1 when a guest finishes a quiz/exam. Nothing else is stored. */
export async function recordGuestQuizCompletion(quizId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE quizzes SET guest_attempt_count = guest_attempt_count + 1 WHERE id = ? AND visibility = 'guest'")
    .bind(quizId)
    .run();
}

/** Anonymous +1 when a guest finishes a study-mode pass. */
export async function recordGuestStudyCompletion(quizId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE quizzes SET guest_study_count = guest_study_count + 1 WHERE id = ? AND visibility = 'guest'")
    .bind(quizId)
    .run();
}

/** Anonymous +1 when a guest finishes a flashcard run. */
export async function recordGuestFlashcardCompletion(setId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE flashcard_sets SET guest_attempt_count = guest_attempt_count + 1 WHERE id = ? AND visibility = 'guest'")
    .bind(setId)
    .run();
}
