import { getDb, generateId, nowIso } from '@/lib/db/client';
import { normalizeForDedup } from '@/lib/utils/normalizeText';
import type {
  Quiz,
  QuizWithStats,
  QuizQuestion,
  QuizInput,
  LinkExpiryOption,
  QuizVisibility,
  QuizAccessMode,
} from '@/types';

interface QuizRow {
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

interface QuestionRow {
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

function mapQuiz(row: QuizRow): Quiz {
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

function mapQuestion(row: QuestionRow): QuizQuestion {
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

export function computeExpiryDate(
  option: LinkExpiryOption | undefined,
  customDate?: string
): string | null {
  if (!option) return null;
  const now = new Date();

  switch (option) {
    case '1d':
      now.setDate(now.getDate() + 1);
      return now.toISOString();

    case '3d':
      now.setDate(now.getDate() + 3);
      return now.toISOString();

    case '7d':
      now.setDate(now.getDate() + 7);
      return now.toISOString();

    case 'custom':
      if (!customDate) {
        throw new Error('customExpiryDate is required when linkExpiry is "custom"');
      }
      return new Date(customDate).toISOString();

    default:
      return null;
  }
}

function generateShareSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const PBKDF2_ITERATIONS = 100_000;

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    hash: bufToHex(derived),
    salt: bufToHex(salt.buffer as ArrayBuffer),
  };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBuf(salt).buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufToHex(derived) === hash;
}

const D1_BATCH_CHUNK_SIZE = 50;

async function runBatchChunked(
  db: ReturnType<typeof getDb>,
  statements: ReturnType<ReturnType<typeof getDb>['prepare']>[]
): Promise<void> {
  for (let i = 0; i < statements.length; i += D1_BATCH_CHUNK_SIZE) {
    const chunk = statements.slice(i, i + D1_BATCH_CHUNK_SIZE);
    await db.batch(chunk);
  }
}

export async function createQuiz(
  creatorId: string,
  input: QuizInput
): Promise<Quiz> {
  const db = getDb();
  const id = generateId('quiz');
  const now = nowIso();

  const shareSlug =
    input.visibility === 'private' ? generateShareSlug() : null;

  const linkExpiresAt =
    input.visibility === 'private'
      ? computeExpiryDate(input.linkExpiry, input.customExpiryDate)
      : null;

  const quizStatement = db
    .prepare(
      `INSERT INTO quizzes (
        id, subcategory_id, creator_id, title, description, mode, difficulty,
        visibility, share_slug, link_expires_at, time_limit_seconds,
        shuffle_questions, shuffle_options,
        anti_cheat_enabled, retake_policy, retake_limit, status, pricing, price_kobo,
        allow_flagging, default_mark, show_marks, leaderboard_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.subcategoryId,
      creatorId,
      input.title,
      input.description ?? null,
      input.mode,
      input.difficulty,
      input.visibility,
      shareSlug,
      linkExpiresAt,
      input.timeLimitSeconds ?? null,
      input.shuffleQuestions ? 1 : 0,
      input.shuffleOptions ? 1 : 0,
      input.antiCheatEnabled ? 1 : 0,
      input.retakePolicy,
      input.retakeLimit ?? null,
      'published',
      input.pricing ?? 'free',
      input.pricing === 'paid' ? input.priceKobo ?? null : null,
      input.allowFlagging ?? true ? 1 : 0,
      input.defaultMark ?? 1,
      input.showMarks ?? true ? 1 : 0,
      input.leaderboardEnabled ?? true ? 1 : 0,
      now,
      now
    );

  const questionStatements = input.questions.map((q, index) =>
    db
      .prepare(
        `INSERT INTO questions (
          id, quiz_id, type, prompt, options, correct_answer,
          explanation, incorrect_rationale, sort_order, mark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId('q'),
        id,
        q.type,
        q.prompt,
        q.options ? JSON.stringify(q.options) : null,
        q.correctAnswer,
        q.explanation ?? null,
        q.incorrectRationale?.trim() || null,
        index,
        q.mark ?? null
      )
  );

  await runBatchChunked(db, [quizStatement, ...questionStatements]);

  return {
    id,
    subcategoryId: input.subcategoryId,
    creatorId,
    title: input.title,
    description: input.description ?? null,
    mode: input.mode,
    difficulty: input.difficulty,
    visibility: input.visibility,
    shareSlug,
    linkExpiresAt,
    accessMode: 'link',
    hasPassword: false,
    timeLimitSeconds: input.timeLimitSeconds ?? null,
    shuffleQuestions: input.shuffleQuestions ?? false,
    shuffleOptions: input.shuffleOptions ?? false,
    antiCheatEnabled: input.antiCheatEnabled,
    retakePolicy: input.retakePolicy,
    retakeLimit: input.retakeLimit ?? null,
    status: 'published',
    pricing: input.pricing ?? 'free',
    priceKobo: input.pricing === 'paid' ? input.priceKobo ?? null : null,
    allowFlagging: input.allowFlagging ?? true,
    defaultMark: input.defaultMark ?? 1,
    showMarks: input.showMarks ?? true,
    leaderboardEnabled: input.leaderboardEnabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateQuiz(
  quizId: string,
  input: QuizInput
): Promise<Quiz> {
  const db = getDb();
  const now = nowIso();

  const existing = await getQuizById(quizId);

  if (!existing) {
    throw new Error('Quiz not found');
  }

  const shareSlug = existing.shareSlug;
  const linkExpiresAt = existing.linkExpiresAt;

  const quizStatement = db
    .prepare(
      `UPDATE quizzes SET
        subcategory_id = ?, title = ?, description = ?, mode = ?, difficulty = ?,
        time_limit_seconds = ?, shuffle_questions = ?, shuffle_options = ?,
        anti_cheat_enabled = ?, retake_policy = ?, retake_limit = ?,
        pricing = ?, price_kobo = ?, allow_flagging = ?, default_mark = ?,
        show_marks = ?, leaderboard_enabled = ?, updated_at = ?
      WHERE id = ?`
    )
    .bind(
      input.subcategoryId,
      input.title,
      input.description ?? null,
      input.mode,
      input.difficulty,
      input.timeLimitSeconds ?? null,
      input.shuffleQuestions ? 1 : 0,
      input.shuffleOptions ? 1 : 0,
      input.antiCheatEnabled ? 1 : 0,
      input.retakePolicy,
      input.retakeLimit ?? null,
      input.pricing ?? 'free',
      input.pricing === 'paid' ? input.priceKobo ?? null : null,
      input.allowFlagging ?? true ? 1 : 0,
      input.defaultMark ?? 1,
      input.showMarks ?? true ? 1 : 0,
      input.leaderboardEnabled ?? true ? 1 : 0,
      now,
      quizId
    );

  const existingIds = new Set(
    (
      await db
        .prepare('SELECT id FROM questions WHERE quiz_id = ?')
        .bind(quizId)
        .all<{ id: string }>()
    ).results.map((r) => r.id)
  );

  const incomingIds = new Set(
    input.questions.filter((q) => q.id).map((q) => q.id as string)
  );

  const removedIds = [...existingIds].filter(
    (id) => !incomingIds.has(id)
  );

  let deletableIds: string[] = removedIds;

  if (removedIds.length > 0) {
    const placeholders = removedIds.map(() => '?').join(',');

    const [attemptRefs, reportRefs] = await Promise.all([
      db
        .prepare(
          `SELECT DISTINCT question_id
           FROM attempt_answers
           WHERE question_id IN (${placeholders})`
        )
        .bind(...removedIds)
        .all<{ question_id: string }>(),

      db
        .prepare(
          `SELECT DISTINCT question_id
           FROM question_reports
           WHERE question_id IN (${placeholders})`
        )
        .bind(...removedIds)
        .all<{ question_id: string }>(),
    ]);

    const referencedIds = new Set([
      ...attemptRefs.results.map((r) => r.question_id),
      ...reportRefs.results.map((r) => r.question_id),
    ]);

    deletableIds = removedIds.filter(
      (id) => !referencedIds.has(id)
    );
  }

  const deleteStatements = deletableIds.map((id) =>
    db
      .prepare('DELETE FROM questions WHERE id = ?')
      .bind(id)
  );

  const questionStatements = input.questions.map((q, index) => {
    if (q.id && existingIds.has(q.id)) {
      return db
        .prepare(
          `UPDATE questions SET
            type = ?, prompt = ?, options = ?, correct_answer = ?,
            explanation = ?, incorrect_rationale = ?, sort_order = ?, mark = ?
          WHERE id = ?`
        )
        .bind(
          q.type,
          q.prompt,
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer,
          q.explanation ?? null,
          q.incorrectRationale?.trim() || null,
          index,
          q.mark ?? null,
          q.id
        );
    }

    return db
      .prepare(
        `INSERT INTO questions (
          id, quiz_id, type, prompt, options, correct_answer,
          explanation, incorrect_rationale, sort_order, mark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId('q'),
        quizId,
        q.type,
        q.prompt,
        q.options ? JSON.stringify(q.options) : null,
        q.correctAnswer,
        q.explanation ?? null,
        q.incorrectRationale?.trim() || null,
        index,
        q.mark ?? null
      );
  });

  await db.batch([quizStatement, ...deleteStatements]);
  await runBatchChunked(db, questionStatements);

  return {
    ...existing,
    subcategoryId: input.subcategoryId,
    title: input.title,
    description: input.description ?? null,
    mode: input.mode,
    difficulty: input.difficulty,
    shareSlug,
    linkExpiresAt,
    timeLimitSeconds: input.timeLimitSeconds ?? null,
    shuffleQuestions: input.shuffleQuestions ?? false,
    shuffleOptions: input.shuffleOptions ?? false,
    antiCheatEnabled: input.antiCheatEnabled,
    retakePolicy: input.retakePolicy,
    retakeLimit: input.retakeLimit ?? null,
    pricing: input.pricing ?? 'free',
    priceKobo:
      input.pricing === 'paid'
        ? input.priceKobo ?? null
        : null,
    allowFlagging: input.allowFlagging ?? true,
    defaultMark: input.defaultMark ?? 1,
    showMarks: input.showMarks ?? true,
    leaderboardEnabled: input.leaderboardEnabled ?? true,
    updatedAt: now,
  };
}

export async function bulkCreateQuizzes(
  creatorId: string,
  inputs: QuizInput[]
): Promise<Quiz[]> {
  const created: Quiz[] = [];

  for (const input of inputs) {
    created.push(await createQuiz(creatorId, input));
  }

  return created;
}

export interface BulkQuizDuplicateReport {
  duplicateTitleIndexes: number[];
  duplicateQuestionsByQuizIndex: Record<
    number,
    {
      prompt: string;
      reason: 'already_in_subcategory' | 'duplicate_in_quiz';
    }[]
  >;
}

export async function findBulkQuizDuplicates(
  inputs: QuizInput[]
): Promise<BulkQuizDuplicateReport> {
  const db = getDb();

  const subcategoryIds = [
    ...new Set(inputs.map((q) => q.subcategoryId)),
  ];

  const existingTitlesBySubcat = new Map<
    string,
    Set<string>
  >();

  const existingPromptsBySubcat = new Map<
    string,
    Set<string>
  >();

  await Promise.all(
    subcategoryIds.map(async (subcategoryId) => {
      const [
        { results: titleRows },
        { results: promptRows },
      ] = await Promise.all([
        db
          .prepare(
            'SELECT title FROM quizzes WHERE subcategory_id = ?'
          )
          .bind(subcategoryId)
          .all<{ title: string }>(),

        db
          .prepare(
            `SELECT q.prompt AS prompt
             FROM questions q
             JOIN quizzes qz ON qz.id = q.quiz_id
             WHERE qz.subcategory_id = ?`
          )
          .bind(subcategoryId)
          .all<{ prompt: string }>(),
      ]);

      existingTitlesBySubcat.set(
        subcategoryId,
        new Set(
          titleRows.map((r) =>
            normalizeForDedup(r.title)
          )
        )
      );

      existingPromptsBySubcat.set(
        subcategoryId,
        new Set(
          promptRows.map((r) =>
            normalizeForDedup(r.prompt)
          )
        )
      );
    })
  );

  const duplicateTitleIndexes: number[] = [];

  const duplicateQuestionsByQuizIndex: BulkQuizDuplicateReport['duplicateQuestionsByQuizIndex'] =
    {};

  const seenInBatchBySubcat = new Map<
    string,
    Set<string>
  >();

  inputs.forEach((input, quizIndex) => {
    const existingTitles =
      existingTitlesBySubcat.get(input.subcategoryId) ??
      new Set();

    if (
      existingTitles.has(
        normalizeForDedup(input.title)
      )
    ) {
      duplicateTitleIndexes.push(quizIndex);
    }

    const existingPrompts =
      existingPromptsBySubcat.get(input.subcategoryId) ??
      new Set();

    if (!seenInBatchBySubcat.has(input.subcategoryId)) {
      seenInBatchBySubcat.set(
        input.subcategoryId,
        new Set()
      );
    }

    const seenInBatch =
      seenInBatchBySubcat.get(input.subcategoryId)!;

    for (const q of input.questions) {
      const key = normalizeForDedup(q.prompt);

      if (existingPrompts.has(key)) {
        (
          duplicateQuestionsByQuizIndex[quizIndex] ??= []
        ).push({
          prompt: q.prompt,
          reason: 'already_in_subcategory',
        });
      } else if (seenInBatch.has(key)) {
        (
          duplicateQuestionsByQuizIndex[quizIndex] ??= []
        ).push({
          prompt: q.prompt,
          reason: 'duplicate_in_quiz',
        });
      }

      seenInBatch.add(key);
    }
  });

  return {
    duplicateTitleIndexes,
    duplicateQuestionsByQuizIndex,
  };
}

export async function getQuizById(
  id: string
): Promise<Quiz | null> {
  const db = getDb();

  const row = await db
    .prepare('SELECT * FROM quizzes WHERE id = ?')
    .bind(id)
    .first<QuizRow>();

  return row ? mapQuiz(row) : null;
}

export async function getQuizByShareSlug(
  slug: string
): Promise<Quiz | null> {
  const db = getDb();

  const row = await db
    .prepare(
      "SELECT * FROM quizzes WHERE share_slug = ? AND visibility = 'private'"
    )
    .bind(slug)
    .first<QuizRow>();

  if (!row) return null;

  const quiz = mapQuiz(row);

  if (
    quiz.accessMode === 'link' &&
    quiz.linkExpiresAt &&
    new Date(quiz.linkExpiresAt).getTime() < Date.now()
  ) {
    return null;
  }

  return quiz;
}

export async function regenerateShareLink(
  quizId: string,
  linkExpiry?: LinkExpiryOption,
  customExpiryDate?: string
): Promise<{
  shareSlug: string;
  linkExpiresAt: string | null;
}> {
  const db = getDb();

  const shareSlug = generateShareSlug();

  const linkExpiresAt = computeExpiryDate(
    linkExpiry,
    customExpiryDate
  );

  await db
    .prepare(
      `UPDATE quizzes
       SET share_slug = ?, link_expires_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      shareSlug,
      linkExpiresAt,
      nowIso(),
      quizId
    )
    .run();

  return {
    shareSlug,
    linkExpiresAt,
  };
}

export async function setQuizVisibility(
  quizId: string,
  visibility: QuizVisibility,
  linkExpiry?: LinkExpiryOption,
  customExpiryDate?: string,
  accessMode?: QuizAccessMode,
  password?: string
): Promise<void> {
  const db = getDb();

  if (visibility === 'guest') {
    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'guest',
             share_slug = NULL,
             link_expires_at = NULL,
             access_mode = 'link',
             password_hash = NULL,
             password_salt = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(nowIso(), quizId)
      .run();

    return;
  }

  if (visibility === 'public') {
    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'public',
             share_slug = NULL,
             link_expires_at = NULL,
             access_mode = 'link',
             password_hash = NULL,
             password_salt = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(nowIso(), quizId)
      .run();

    return;
  }

  const shareSlug = generateShareSlug();

  const mode: QuizAccessMode =
    accessMode ?? 'link';

  if (mode === 'password') {
    if (!password) {
      throw new Error(
        'A password is required when accessMode is "password"'
      );
    }

    const { hash, salt } =
      await hashPassword(password);

    await db
      .prepare(
        `UPDATE quizzes
         SET visibility = 'private',
             share_slug = ?,
             link_expires_at = NULL,
             access_mode = 'password',
             password_hash = ?,
             password_salt = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        shareSlug,
        hash,
        salt,
        nowIso(),
        quizId
      )
      .run();

    return;
  }

  const linkExpiresAt = computeExpiryDate(
    linkExpiry,
    customExpiryDate
  );

  await db
    .prepare(
      `UPDATE quizzes
       SET visibility = 'private',
           share_slug = ?,
           link_expires_at = ?,
           access_mode = 'link',
           password_hash = NULL,
           password_salt = NULL,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      shareSlug,
      linkExpiresAt,
      nowIso(),
      quizId
    )
    .run();
}

export async function setQuizPassword(
  quizId: string,
  password: string
): Promise<void> {
  const db = getDb();

  const { hash, salt } =
    await hashPassword(password);

  await db
    .prepare(
      `UPDATE quizzes
       SET access_mode = 'password',
           password_hash = ?,
           password_salt = ?,
           updated_at = ?
       WHERE id = ?
       AND visibility = 'private'`
    )
    .bind(
      hash,
      salt,
      nowIso(),
      quizId
    )
    .run();
}

export async function checkQuizPassword(
  quizId: string,
  password: string
): Promise<boolean> {
  const db = getDb();

  const row = await db
    .prepare(
      `SELECT password_hash, password_salt
       FROM quizzes
       WHERE id = ?
       AND visibility = 'private'
       AND access_mode = 'password'`
    )
    .bind(quizId)
    .first<{
      password_hash: string | null;
      password_salt: string | null;
    }>();

  if (!row?.password_hash || !row.password_salt) {
    return false;
  }

  return verifyPassword(
    password,
    row.password_hash,
    row.password_salt
  );
}

export async function getQuizQuestions(
  quizId: string
): Promise<QuizQuestion[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT *
       FROM questions
       WHERE quiz_id = ?
       ORDER BY sort_order ASC`
    )
    .bind(quizId)
    .all<QuestionRow>();

  return results.map(mapQuestion);
}

export async function listLatestPublicQuizzes(
  limit = 20
): Promise<QuizWithStats[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts
         WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        c.name as category_name,
        s.name as subcategory_name,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN subcategories s ON s.id = q.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = q.creator_id
      WHERE q.visibility = 'public'
        AND q.status = 'published'
      ORDER BY q.updated_at DESC
      LIMIT ?`
    )
    .bind(limit)
    .all<
      QuizRow & {
        question_count: number;
        attempt_count: number;
        avg_score: number | null;
        comment_count: number;
        category_name: string;
        subcategory_name: string;
        creator_name: string | null;
        creator_contact: string | null;
      }
    >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    creatorName: row.creator_name ?? 'Anonymous',
    creatorContact: row.creator_contact,
  }));
}

export async function listLatestPublicQuizzesPaginated(
  page = 1,
  pageSize = 12
): Promise<{
  quizzes: QuizWithStats[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = getDb();

  const offset = Math.max(
    0,
    (page - 1) * pageSize
  );

  const [{ results }, countRow] =
    await Promise.all([
      db
        .prepare(
          `SELECT
            q.*,
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
            (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
             FROM quiz_attempts
             WHERE quiz_id = q.id) as avg_score,
            (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
            c.name as category_name,
            s.name as subcategory_name,
            u.display_name as creator_name,
            u.contact_phone as creator_contact
          FROM quizzes q
          JOIN subcategories s ON s.id = q.subcategory_id
          JOIN categories c ON c.id = s.category_id
          JOIN users u ON u.id = q.creator_id
          WHERE q.visibility = 'public'
            AND q.status = 'published'
          ORDER BY q.updated_at DESC
          LIMIT ? OFFSET ?`
        )
        .bind(pageSize, offset)
        .all<
          QuizRow & {
            question_count: number;
            attempt_count: number;
            avg_score: number | null;
            comment_count: number;
            category_name: string;
            subcategory_name: string;
            creator_name: string | null;
            creator_contact: string | null;
          }
        >(),

      db
        .prepare(
          `SELECT COUNT(*) as total
           FROM quizzes q
           WHERE q.visibility = 'public'
           AND q.status = 'published'`
        )
        .first<{ total: number }>(),
    ]);

  return {
    quizzes: results.map((row) => ({
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      categoryName: row.category_name,
      subcategoryName: row.subcategory_name,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    })),
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getQuizzesWithStatsByIds(
  ids: string[]
): Promise<QuizWithStats[]> {
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
         FROM quiz_attempts
         WHERE quiz_id = q.id) as avg_score,
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
    .all<
      QuizRow & {
        question_count: number;
        attempt_count: number;
        study_attempt_count: number;
        avg_score: number | null;
        comment_count: number;
        category_name: string;
        subcategory_name: string;
        creator_name: string | null;
        creator_contact: string | null;
      }
    >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    studyAttemptCount: row.study_attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    creatorName: row.creator_name ?? 'Anonymous',
    creatorContact: row.creator_contact,
  }));
}

export async function listQuizzesByCategories(
  categoryIds: string[],
  limit = 7
): Promise<Record<string, QuizWithStats[]>> {
  const grouped: Record<string, QuizWithStats[]> = {};

  if (!categoryIds.length) return grouped;

  const db = getDb();
  const placeholders = categoryIds.map(() => '?').join(', ');

  const { results } = await db
    .prepare(
      `WITH ranked AS (
        SELECT
          q.*,
          s.category_id,
          ROW_NUMBER() OVER (
            PARTITION BY s.category_id
            ORDER BY q.updated_at DESC
          ) AS category_rank
        FROM quizzes q
        JOIN subcategories s ON s.id = q.subcategory_id
        WHERE s.category_id IN (${placeholders})
          AND q.visibility = 'public'
          AND q.status = 'published'
      )
      SELECT
        ranked.*,
        (SELECT COUNT(*)
         FROM questions
         WHERE questions.quiz_id = ranked.id) AS question_count,
        COALESCE(qas.attempt_count, 0) AS attempt_count,
        CASE
          WHEN qas.attempt_count > 0
          THEN qas.percentage_sum / qas.attempt_count
          ELSE NULL
        END AS avg_score,
        (SELECT COUNT(*)
         FROM comments
         WHERE comments.quiz_id = ranked.id) AS comment_count,
        u.display_name AS creator_name,
        u.contact_phone AS creator_contact
      FROM ranked
      JOIN users u ON u.id = ranked.creator_id
      LEFT JOIN quiz_attempt_stats qas
        ON qas.quiz_id = ranked.id
      WHERE ranked.category_rank <= ?
      ORDER BY ranked.category_id, ranked.updated_at DESC`
    )
    .bind(...categoryIds, limit)
    .all<
      QuizRow & {
        category_id: string;
        category_rank: number;
        question_count: number;
        attempt_count: number;
        avg_score: number | null;
        comment_count: number;
        creator_name: string | null;
        creator_contact: string | null;
      }
    >();

  for (const id of categoryIds) {
    grouped[id] = [];
  }

  for (const row of results) {
    (grouped[row.category_id] ??= []).push({
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    });
  }

  return grouped;
}

export async function listQuizzesByCategoryPaginated(
  categoryId: string,
  page = 1,
  pageSize = 25
): Promise<{
  quizzes: QuizWithStats[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = getDb();

  const offset = Math.max(
    0,
    (page - 1) * pageSize
  );

  const [{ results }, countRow] =
    await Promise.all([
      db
        .prepare(
          `SELECT
            q.*,
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
            (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
             FROM quiz_attempts
             WHERE quiz_id = q.id) as avg_score,
            (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
            u.display_name as creator_name,
            u.contact_phone as creator_contact
          FROM quizzes q
          JOIN subcategories s ON s.id = q.subcategory_id
          JOIN users u ON u.id = q.creator_id
          WHERE s.category_id = ?
            AND q.visibility = 'public'
            AND q.status = 'published'
          ORDER BY q.updated_at DESC
          LIMIT ? OFFSET ?`
        )
        .bind(categoryId, pageSize, offset)
        .all<
          QuizRow & {
            question_count: number;
            attempt_count: number;
            avg_score: number | null;
            comment_count: number;
            creator_name: string | null;
            creator_contact: string | null;
          }
        >(),

      db
        .prepare(
          `SELECT COUNT(*) as total
           FROM quizzes q
           JOIN subcategories s ON s.id = q.subcategory_id
           WHERE s.category_id = ?
             AND q.visibility = 'public'
             AND q.status = 'published'`
        )
        .bind(categoryId)
        .first<{ total: number }>(),
    ]);

  return {
    quizzes: results.map((row) => ({
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    })),
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function listQuizzesByCategory(
  categoryId: string,
  limit?: number
): Promise<QuizWithStats[]> {
  const db = getDb();

  const query = `SELECT
      q.*,
      (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
      (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
       FROM quiz_attempts
       WHERE quiz_id = q.id) as avg_score,
      (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
      u.display_name as creator_name,
      u.contact_phone as creator_contact
    FROM quizzes q
    JOIN subcategories s ON s.id = q.subcategory_id
    JOIN users u ON u.id = q.creator_id
    WHERE s.category_id = ?
      AND q.visibility = 'public'
      AND q.status = 'published'
    ORDER BY q.updated_at DESC${limit ? ' LIMIT ?' : ''}`;

  const stmt = limit
    ? db.prepare(query).bind(categoryId, limit)
    : db.prepare(query).bind(categoryId);

  const { results } = await stmt.all<
    QuizRow & {
      question_count: number;
      attempt_count: number;
      avg_score: number | null;
      comment_count: number;
      creator_name: string | null;
      creator_contact: string | null;
    }
  >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
    creatorName: row.creator_name ?? 'Anonymous',
    creatorContact: row.creator_contact,
  }));
}

export async function listQuizzesBySubcategoryPaginated(
  subcategoryId: string,
  page = 1,
  pageSize = 25
): Promise<{
  quizzes: QuizWithStats[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = getDb();

  const offset = Math.max(
    0,
    (page - 1) * pageSize
  );

  const [{ results }, countRow] =
    await Promise.all([
      db
        .prepare(
          `SELECT
            q.*,
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
            (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
             FROM quiz_attempts
             WHERE quiz_id = q.id) as avg_score,
            (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
            u.display_name as creator_name,
            u.contact_phone as creator_contact
          FROM quizzes q
          JOIN users u ON u.id = q.creator_id
          WHERE q.subcategory_id = ?
            AND q.visibility = 'public'
            AND q.status = 'published'
          ORDER BY q.updated_at DESC
          LIMIT ? OFFSET ?`
        )
        .bind(
          subcategoryId,
          pageSize,
          offset
        )
        .all<
          QuizRow & {
            question_count: number;
            attempt_count: number;
            avg_score: number | null;
            comment_count: number;
            creator_name: string | null;
            creator_contact: string | null;
          }
        >(),

      db
        .prepare(
          `SELECT COUNT(*) as total
           FROM quizzes q
           WHERE q.subcategory_id = ?
             AND q.visibility = 'public'
             AND q.status = 'published'`
        )
        .bind(subcategoryId)
        .first<{ total: number }>(),
    ]);

  return {
    quizzes: results.map((row) => ({
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    })),
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function listQuizzesBySubcategory(
  subcategoryId: string
): Promise<QuizWithStats[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts
         WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
        u.display_name as creator_name,
        u.contact_phone as creator_contact
      FROM quizzes q
      JOIN users u ON u.id = q.creator_id
      WHERE q.subcategory_id = ?
        AND q.visibility = 'public'
        AND q.status = 'published'
      ORDER BY q.updated_at DESC`
    )
    .bind(subcategoryId)
    .all<
      QuizRow & {
        question_count: number;
        attempt_count: number;
        avg_score: number | null;
        comment_count: number;
        creator_name: string | null;
        creator_contact: string | null;
      }
    >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
    creatorName: row.creator_name ?? 'Anonymous',
    creatorContact: row.creator_contact,
  }));
}

export async function listRelatedQuizzes(
  subcategoryId: string,
  excludeQuizId: string | null,
  limit = 3
): Promise<QuizWithStats[]> {
  const db = getDb();

  const baseSelect = `
    q.*,
    (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
    (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
    (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
     FROM quiz_attempts
     WHERE quiz_id = q.id) as avg_score,
    (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
    u.display_name as creator_name,
    u.contact_phone as creator_contact
  `;

  type Row = QuizRow & {
    question_count: number;
    attempt_count: number;
    avg_score: number | null;
    comment_count: number;
    creator_name: string | null;
    creator_contact: string | null;
  };

  function toQuizWithStats(row: Row): QuizWithStats {
    return {
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    };
  }

  const excludeClause = excludeQuizId
    ? 'AND q.id != ?'
    : '';

  const excludeArgs = excludeQuizId
    ? [excludeQuizId]
    : [];

  const { results: sameSubcategory } =
    await db
      .prepare(
        `SELECT ${baseSelect}
         FROM quizzes q
         JOIN users u ON u.id = q.creator_id
         WHERE q.subcategory_id = ?
           AND q.visibility = 'public'
           AND q.status = 'published'
           ${excludeClause}
         ORDER BY q.updated_at DESC
         LIMIT ?`
      )
      .bind(
        subcategoryId,
        ...excludeArgs,
        limit
      )
      .all<Row>();

  const picked =
    sameSubcategory.map(toQuizWithStats);

  if (picked.length >= limit) {
    return picked.slice(0, limit);
  }

  const pickedIds = new Set(
    picked.map((q) => q.id)
  );

  const remaining = limit - picked.length;

  const { results: sameCategory } =
    await db
      .prepare(
        `SELECT ${baseSelect}
         FROM quizzes q
         JOIN users u ON u.id = q.creator_id
         JOIN subcategories s ON s.id = q.subcategory_id
         WHERE s.category_id = (
           SELECT category_id
           FROM subcategories
           WHERE id = ?
         )
           AND q.subcategory_id != ?
           AND q.visibility = 'public'
           AND q.status = 'published'
           ${excludeClause}
         ORDER BY q.updated_at DESC
         LIMIT ?`
      )
      .bind(
        subcategoryId,
        subcategoryId,
        ...excludeArgs,
        remaining
      )
      .all<Row>();

  for (const row of sameCategory) {
    if (picked.length >= limit) break;

    if (!pickedIds.has(row.id)) {
      picked.push(toQuizWithStats(row));
      pickedIds.add(row.id);
    }
  }

  if (picked.length >= limit) {
    return picked.slice(0, limit);
  }

  const stillNeeded =
    limit - picked.length;

  const { results: latest } =
    await db
      .prepare(
        `SELECT ${baseSelect}
         FROM quizzes q
         JOIN users u ON u.id = q.creator_id
         WHERE q.visibility = 'public'
           AND q.status = 'published'
           ${excludeClause}
         ORDER BY q.updated_at DESC
         LIMIT ?`
      )
      .bind(
        ...excludeArgs,
        stillNeeded + picked.length
      )
      .all<Row>();

  for (const row of latest) {
    if (picked.length >= limit) break;

    if (!pickedIds.has(row.id)) {
      picked.push(toQuizWithStats(row));
      pickedIds.add(row.id);
    }
  }

  return picked.slice(0, limit);
}

export async function listRelatedQuizzesByLabel(
  categoryLabel: string | null,
  limit = 3
): Promise<QuizWithStats[]> {
  const db = getDb();

  const baseSelect = `
    q.*,
    (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
    (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
    (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
     FROM quiz_attempts
     WHERE quiz_id = q.id) as avg_score,
    (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count,
    u.display_name as creator_name,
    u.contact_phone as creator_contact
  `;

  type Row = QuizRow & {
    question_count: number;
    attempt_count: number;
    avg_score: number | null;
    comment_count: number;
    creator_name: string | null;
    creator_contact: string | null;
  };

  function toQuizWithStats(row: Row): QuizWithStats {
    return {
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
      creatorName: row.creator_name ?? 'Anonymous',
      creatorContact: row.creator_contact,
    };
  }

  const picked: QuizWithStats[] = [];
  const pickedIds = new Set<string>();

  if (categoryLabel && categoryLabel.trim()) {
    const label = categoryLabel.trim();

    const { results: bySubcategory } =
      await db
        .prepare(
          `SELECT ${baseSelect}
           FROM quizzes q
           JOIN users u ON u.id = q.creator_id
           JOIN subcategories s ON s.id = q.subcategory_id
           WHERE LOWER(s.name) = LOWER(?)
             AND q.visibility = 'public'
             AND q.status = 'published'
           ORDER BY q.updated_at DESC
           LIMIT ?`
        )
        .bind(label, limit)
        .all<Row>();

    for (const row of bySubcategory) {
      if (picked.length >= limit) break;

      picked.push(toQuizWithStats(row));
      pickedIds.add(row.id);
    }

    if (picked.length < limit) {
      const { results: byCategory } =
        await db
          .prepare(
            `SELECT ${baseSelect}
             FROM quizzes q
             JOIN users u ON u.id = q.creator_id
             JOIN subcategories s ON s.id = q.subcategory_id
             JOIN categories c ON c.id = s.category_id
             WHERE LOWER(c.name) = LOWER(?)
               AND q.visibility = 'public'
               AND q.status = 'published'
             ORDER BY q.updated_at DESC
             LIMIT ?`
          )
          .bind(
            label,
            limit - picked.length
          )
          .all<Row>();

      for (const row of byCategory) {
        if (picked.length >= limit) break;

        if (!pickedIds.has(row.id)) {
          picked.push(toQuizWithStats(row));
          pickedIds.add(row.id);
        }
      }
    }
  }

  if (picked.length < limit) {
    const excludeClause =
      pickedIds.size > 0
        ? `AND q.id NOT IN (${[
            ...pickedIds,
          ]
            .map(() => '?')
            .join(',')})`
        : '';

    const { results: latest } =
      await db
        .prepare(
          `SELECT ${baseSelect}
           FROM quizzes q
           JOIN users u ON u.id = q.creator_id
           WHERE q.visibility = 'public'
             AND q.status = 'published'
             ${excludeClause}
           ORDER BY q.updated_at DESC
           LIMIT ?`
        )
        .bind(
          ...pickedIds,
          limit - picked.length
        )
        .all<Row>();

    for (const row of latest) {
      if (picked.length >= limit) break;

      picked.push(toQuizWithStats(row));
    }
  }

  return picked.slice(0, limit);
}

export async function listQuizzesByCreator(
  creatorId: string
): Promise<QuizWithStats[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts
         WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
      FROM quizzes q
      WHERE q.creator_id = ?
      ORDER BY q.updated_at DESC`
    )
    .bind(creatorId)
    .all<
      QuizRow & {
        question_count: number;
        attempt_count: number;
        avg_score: number | null;
        comment_count: number;
      }
    >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
  }));
}

export async function listPublicQuizzesByCreator(
  creatorId: string
): Promise<QuizWithStats[]> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT
        q.*,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
        (SELECT COUNT(*) FROM study_attempts WHERE quiz_id = q.id) as study_attempt_count,
        (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
         FROM quiz_attempts
         WHERE quiz_id = q.id) as avg_score,
        (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
      FROM quizzes q
      WHERE q.creator_id = ?
        AND q.visibility = 'public'
      ORDER BY q.updated_at DESC`
    )
    .bind(creatorId)
    .all<
      QuizRow & {
        question_count: number;
        attempt_count: number;
        study_attempt_count: number;
        avg_score: number | null;
        comment_count: number;
      }
    >();

  return results.map((row) => ({
    ...mapQuiz(row),
    questionCount: row.question_count,
    attemptCount: row.attempt_count,
    studyAttemptCount: row.study_attempt_count,
    averageScorePercent: row.avg_score,
    commentCount: row.comment_count,
  }));
}

export async function updateQuizStatus(
  quizId: string,
  status: Quiz['status']
): Promise<void> {
  const db = getDb();

  await db
    .prepare(
      'UPDATE quizzes SET status = ?, updated_at = ? WHERE id = ?'
    )
    .bind(status, nowIso(), quizId)
    .run();
}

export async function deleteQuiz(
  quizId: string
): Promise<void> {
  const db = getDb();

  const { results: questionRows } =
    await db
      .prepare(
        'SELECT id FROM questions WHERE quiz_id = ?'
      )
      .bind(quizId)
      .all<{ id: string }>();

  const questionIds =
    questionRows.map((r) => r.id);

  const { results: commentRows } =
    await db
      .prepare(
        'SELECT id FROM comments WHERE quiz_id = ?'
      )
      .bind(quizId)
      .all<{ id: string }>();

  const commentIds =
    commentRows.map((r) => r.id);

  const placeholders = (n: number) =>
    Array(n).fill('?').join(', ');

  const CHUNK_SIZE = 100;

  function chunk<T>(
    arr: T[],
    size: number
  ): T[][] {
    const out: T[][] = [];

    for (
      let i = 0;
      i < arr.length;
      i += size
    ) {
      out.push(arr.slice(i, i + size));
    }

    return out;
  }

  if (questionIds.length > 0) {
    for (const idsChunk of chunk(
      questionIds,
      CHUNK_SIZE
    )) {
      await db
        .prepare(
          `DELETE FROM question_reports
           WHERE question_id IN (${placeholders(
             idsChunk.length
           )})`
        )
        .bind(...idsChunk)
        .run();

      await db
        .prepare(
          `DELETE FROM attempt_answers
           WHERE question_id IN (${placeholders(
             idsChunk.length
           )})`
        )
        .bind(...idsChunk)
        .run();
    }
  }

  if (commentIds.length > 0) {
    for (const idsChunk of chunk(
      commentIds,
      CHUNK_SIZE
    )) {
      await db
        .prepare(
          `DELETE FROM comment_reactions
           WHERE comment_id IN (${placeholders(
             idsChunk.length
           )})`
        )
        .bind(...idsChunk)
        .run();
    }
  }

  await db
    .prepare(
      'DELETE FROM questions WHERE quiz_id = ?'
    )
    .bind(quizId)
    .run();

  await db
    .prepare(
      'DELETE FROM quiz_attempts WHERE quiz_id = ?'
    )
    .bind(quizId)
    .run();

  await db
    .prepare(
      'DELETE FROM comments WHERE quiz_id = ?'
    )
    .bind(quizId)
    .run();

  await db
    .prepare(
      'DELETE FROM certificates WHERE quiz_id = ?'
    )
    .bind(quizId)
    .run();

  await db
    .prepare(
      'DELETE FROM quiz_purchases WHERE quiz_id = ?'
    )
    .bind(quizId)
    .run();

  await db
    .prepare(
      'DELETE FROM quizzes WHERE id = ?'
    )
    .bind(quizId)
    .run();
}

export async function adminListAllQuizzes(
  page = 1,
  pageSize = 20
): Promise<{
  quizzes: QuizWithStats[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = getDb();

  const offset = Math.max(
    0,
    (page - 1) * pageSize
  );

  const [{ results }, countRow] =
    await Promise.all([
      db
        .prepare(
          `SELECT
            q.*,
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count,
            (SELECT AVG(CAST(score AS REAL) / total_questions * 100)
             FROM quiz_attempts
             WHERE quiz_id = q.id) as avg_score,
            (SELECT COUNT(*) FROM comments WHERE quiz_id = q.id) as comment_count
          FROM quizzes q
          ORDER BY q.updated_at DESC
          LIMIT ? OFFSET ?`
        )
        .bind(pageSize, offset)
        .all<
          QuizRow & {
            question_count: number;
            attempt_count: number;
            avg_score: number | null;
            comment_count: number;
          }
        >(),

      db
        .prepare(
          'SELECT COUNT(*) as total FROM quizzes'
        )
        .first<{ total: number }>(),
    ]);

  return {
    quizzes: results.map((row) => ({
      ...mapQuiz(row),
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
      averageScorePercent: row.avg_score,
      commentCount: row.comment_count,
    })),
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}
