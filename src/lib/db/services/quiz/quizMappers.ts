// src/lib/db/services/quiz/quizMappers.ts
// Shared row shapes and mappers used by every quiz sub-service.
// No business logic here — just type-safe row -> domain-object conversion.

import type { Quiz, QuizQuestion, QuizAccessMode } from '@/types';

export interface QuizRow {
  id: string;
  subcategory_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  mode: string;
  difficulty: string;
  visibility: string;
  share_slug: string | null;
  link_expires_at: string | null;
  access_mode: string;
  password_hash: string | null;
  password_salt: string | null;
  time_limit_seconds: number | null;
  time_limit_mode?: string | null;
  shuffle_questions: number;
  shuffle_options: number;
  anti_cheat_enabled: number;
  retake_policy: string;
  retake_limit: number | null;
  status: string;
  pricing: string;
  price_kobo: number | null;
  allow_flagging: number;
  default_mark: number;
  show_marks: number;
  leaderboard_enabled: number;
  guest_attempt_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionRow {
  id: string;
  quiz_id: string;
  type: string;
  prompt: string;
  options: string | null;
  correct_answer: string;
  explanation: string | null;
  incorrect_rationale?: string | null;
  sort_order: number;
  mark: number | null;
}

export function mapQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    subcategoryId: row.subcategory_id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    mode: row.mode as Quiz['mode'],
    difficulty: row.difficulty as Quiz['difficulty'],
    visibility: row.visibility as Quiz['visibility'],
    shareSlug: row.share_slug,
    linkExpiresAt: row.link_expires_at,
    accessMode: (row.access_mode as QuizAccessMode) ?? 'link',
    hasPassword: !!row.password_hash,
    timeLimitSeconds: row.time_limit_seconds,
    timeLimitMode: row.time_limit_mode === 'user_choice' ? 'user_choice' : 'fixed',
    shuffleQuestions: row.shuffle_questions === 1,
    shuffleOptions: row.shuffle_options === 1,
    antiCheatEnabled: row.anti_cheat_enabled === 1,
    retakePolicy: row.retake_policy as Quiz['retakePolicy'],
    retakeLimit: row.retake_limit,
    status: row.status as Quiz['status'],
    pricing: row.pricing as Quiz['pricing'],
    priceKobo: row.price_kobo,
    allowFlagging: row.allow_flagging === 1,
    defaultMark: row.default_mark,
    showMarks: row.show_marks === 1,
    leaderboardEnabled: row.leaderboard_enabled === 1,
    guestAttemptCount: row.guest_attempt_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQuestion(row: QuestionRow): QuizQuestion {
  return {
    id: row.id,
    quizId: row.quiz_id,
    type: row.type as QuizQuestion['type'],
    prompt: row.prompt,
    options: row.options ? JSON.parse(row.options) : null,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    incorrectRationale: row.incorrect_rationale ?? null,
    sortOrder: row.sort_order,
    mark: row.mark,
  };
}

/**
 * Standard "quiz + stats" shape returned by every public list/getById query.
 * Every list call previously repeated this ~12-line shape inline; centralising
 * it means a new stat field only needs adding in one place.
 */
export interface QuizStatsRow extends QuizRow {
  question_count: number;
  attempt_count: number;
  study_attempt_count?: number;
  avg_score: number | null;
  comment_count: number;
  category_name?: string;
  subcategory_name?: string;
  creator_name?: string | null;
  creator_contact?: string | null;
}

export function mapQuizWithStats(row: QuizStatsRow) {
  return {
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    studyAttemptCount: row.study_attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    creatorName: row.creator_name ?? 'Anonymous',
    creatorContact: row.creator_contact ?? null,
  };
}
