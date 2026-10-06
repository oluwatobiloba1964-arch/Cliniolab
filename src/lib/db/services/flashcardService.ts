// File: src/lib/db/services/flashcardService.ts
import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Flashcard, FlashcardInput, FlashcardSet, FlashcardSetWithStats } from '@/types';

interface FlashcardSetRow {
  id: string;
  subcategory_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  visibility: string;
  status: string;
  pricing: string;
  price_kobo: number | null;
  shuffle_cards: number;
  created_at: string;
  updated_at: string;
}

interface FlashcardRow {
  id: string;
  set_id: string;
  front: string;
  back: string;
  explanation: string | null;
  sort_order: number;
}

function mapSet(row: FlashcardSetRow): FlashcardSet {
  return {
    id: row.id,
    subcategoryId: row.subcategory_id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility as FlashcardSet['visibility'],
    status: row.status as FlashcardSet['status'],
    pricing: row.pricing as FlashcardSet['pricing'],
    priceKobo: row.price_kobo,
    shuffleCards: row.shuffle_cards === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    setId: row.set_id,
    front: row.front,
    back: row.back,
    explanation: row.explanation,
    sortOrder: row.sort_order,
  };
}

export async function createFlashcardSet(creatorId: string, input: FlashcardInput): Promise<FlashcardSet> {
  const db = getDb();
  const id = generateId('fcset');
  const now = nowIso();
  const pricing = input.pricing ?? 'free';
  const priceKobo = pricing === 'paid' ? input.priceKobo ?? null : null;

  await db
    .prepare(
      `INSERT INTO flashcard_sets
        (id, subcategory_id, creator_id, title, description, visibility, status, pricing, price_kobo, shuffle_cards, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.subcategoryId,
      creatorId,
      input.title,
      input.description ?? null,
      input.visibility,
      pricing,
      priceKobo,
      input.shuffleCards ? 1 : 0,
      now,
      now
    )
    .run();

  const statements = input.cards.map((card, i) =>
    db
      .prepare(
        `INSERT INTO flashcards (id, set_id, front, back, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(generateId('fc'), id, card.front, card.back, card.explanation ?? null, i)
  );
  if (statements.length > 0) await db.batch(statements);

  return {
    id,
    subcategoryId: input.subcategoryId,
    creatorId,
    title: input.title,
    description: input.description ?? null,
    visibility: input.visibility,
    status: 'published',
    pricing,
    priceKobo,
    shuffleCards: input.shuffleCards ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateFlashcardSet(setId: string, input: FlashcardInput): Promise<FlashcardSet> {
  const db = getDb();
  const now = nowIso();
  const pricing = input.pricing ?? 'free';
  const priceKobo = pricing === 'paid' ? input.priceKobo ?? null : null;

  await db
    .prepare(
      `UPDATE flashcard_sets
       SET subcategory_id = ?, title = ?, description = ?, visibility = ?, pricing = ?, price_kobo = ?, shuffle_cards = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      input.subcategoryId,
      input.title,
      input.description ?? null,
      input.visibility,
      pricing,
      priceKobo,
      input.shuffleCards ? 1 : 0,
      now,
      setId
    )
    .run();

  // Replace all cards wholesale — simplest correct approach and matches
  // how bulk quiz edits are typically done from a full form re-submit.
  await db.prepare('DELETE FROM flashcards WHERE set_id = ?').bind(setId).run();
  const statements = input.cards.map((card, i) =>
    db
      .prepare(
        `INSERT INTO flashcards (id, set_id, front, back, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(card.id ?? generateId('fc'), setId, card.front, card.back, card.explanation ?? null, i)
  );
  if (statements.length > 0) await db.batch(statements);

  const updated = await getFlashcardSetById(setId);
  if (!updated) throw new Error('Flashcard set not found after update');
  return updated;
}

export async function getFlashcardSetById(id: string): Promise<FlashcardSet | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM flashcard_sets WHERE id = ?').bind(id).first<FlashcardSetRow>();
  return row ? mapSet(row) : null;
}

/** Same as getFlashcardSetById but joined with card count, category, subcategory and creator name — used for the share preview on the detail page. */
export async function getFlashcardSetByIdWithStats(id: string): Promise<FlashcardSetWithStats | null> {
  const db = getDb();
  const row = await db
    .prepare(`SELECT ${STATS_SELECT} WHERE fs.id = ?`)
    .bind(id)
    .first<StatsRow>();
  return row ? mapStatsRow(row) : null;
}

export async function getFlashcardsBySetId(setId: string): Promise<Flashcard[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM flashcards WHERE set_id = ? ORDER BY sort_order ASC')
    .bind(setId)
    .all<FlashcardRow>();
  return results.map(mapCard);
}

export async function deleteFlashcardSet(setId: string): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('DELETE FROM flashcard_purchases WHERE set_id = ?').bind(setId),
    db.prepare('DELETE FROM flashcards WHERE set_id = ?').bind(setId),
    db.prepare('DELETE FROM flashcard_sets WHERE id = ?').bind(setId),
  ]);
}

export async function setFlashcardSetVisibility(
  setId: string,
  visibility: FlashcardSet['visibility']
): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE flashcard_sets SET visibility = ?, updated_at = ? WHERE id = ?')
    .bind(visibility, nowIso(), setId)
    .run();
}

const STATS_SELECT = `
  fs.*,
  (SELECT COUNT(*) FROM flashcards WHERE set_id = fs.id) as card_count,
  (SELECT COUNT(*) FROM flashcard_attempts WHERE set_id = fs.id) as attempt_count,
  c.name as category_name,
  s.name as subcategory_name,
  u.display_name as creator_name
  FROM flashcard_sets fs
  JOIN subcategories s ON s.id = fs.subcategory_id
  JOIN categories c ON c.id = s.category_id
  JOIN users u ON u.id = fs.creator_id
`;

type StatsRow = FlashcardSetRow & {
  card_count: number;
  attempt_count: number;
  category_name: string;
  subcategory_name: string;
  creator_name: string | null;
};

function mapStatsRow(row: StatsRow): FlashcardSetWithStats {
  return {
    ...mapSet(row),
    cardCount: row.card_count,
    attemptCount: row.attempt_count,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    creatorName: row.creator_name ?? 'Anonymous',
  };
}

/** General "all flashcards" homepage feed — latest published public sets across every category. */
export async function listLatestPublicFlashcardSets(limit = 20): Promise<FlashcardSetWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${STATS_SELECT}
       WHERE fs.visibility = 'public' AND fs.status = 'published'
       ORDER BY fs.updated_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<StatsRow>();
  return results.map(mapStatsRow);
}

export async function listLatestPublicFlashcardSetsPaginated(
  page = 1,
  pageSize = 12
): Promise<{ sets: FlashcardSetWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);
  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT ${STATS_SELECT}
         WHERE fs.visibility = 'public' AND fs.status = 'published'
         ORDER BY fs.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(pageSize, offset)
      .all<StatsRow>(),
    db
      .prepare(`SELECT COUNT(*) as total FROM flashcard_sets WHERE visibility = 'public' AND status = 'published'`)
      .first<{ total: number }>(),
  ]);
  return { sets: results.map(mapStatsRow), total: countRow?.total ?? 0, page, pageSize };
}

/** Used for each category's homepage block (labelled "Flashcard"), same shape/limit style as CategoryQuizSection. */
export async function listFlashcardSetsByCategory(categoryId: string, limit?: number): Promise<FlashcardSetWithStats[]> {
  const db = getDb();
  const query = `
    SELECT ${STATS_SELECT}
    WHERE c.id = ? AND fs.visibility = 'public' AND fs.status = 'published'
    ORDER BY fs.updated_at DESC
    ${limit ? 'LIMIT ?' : ''}
  `;
  const stmt = limit ? db.prepare(query).bind(categoryId, limit) : db.prepare(query).bind(categoryId);
  const { results } = await stmt.all<StatsRow>();
  return results.map(mapStatsRow);
}


/** Public homepage feed: rank a small slice per category in one D1 statement. */
export async function listFlashcardSetsByCategories(categoryIds: string[], limit = 1): Promise<Record<string, FlashcardSetWithStats[]>> {
  const grouped: Record<string, FlashcardSetWithStats[]> = {};
  if (!categoryIds.length) return grouped;
  const db = getDb();
  const placeholders = categoryIds.map(() => '?').join(', ');
  const { results } = await db
    .prepare(
      `WITH ranked AS (
        SELECT fs.*, c.id as category_id,
          ROW_NUMBER() OVER (
            PARTITION BY c.id
            ORDER BY fs.updated_at DESC
          ) AS category_rank
        FROM flashcard_sets fs
        JOIN subcategories s ON s.id = fs.subcategory_id
        JOIN categories c ON c.id = s.category_id
        WHERE c.id IN (${placeholders})
          AND fs.visibility = 'public' AND fs.status = 'published'
      ),
      top_ranked AS (
        SELECT * FROM ranked WHERE category_rank <= ?
      )
      SELECT top_ranked.*,
        (SELECT COUNT(*) FROM flashcards WHERE set_id = top_ranked.id) as card_count,
        (SELECT COUNT(*) FROM flashcard_attempts WHERE set_id = top_ranked.id) as attempt_count,
        c.name as category_name,
        s.name as subcategory_name,
        u.display_name as creator_name
      FROM top_ranked
      JOIN subcategories s ON s.id = top_ranked.subcategory_id
      JOIN categories c ON c.id = top_ranked.category_id
      JOIN users u ON u.id = top_ranked.creator_id
      ORDER BY top_ranked.category_id, top_ranked.updated_at DESC`
    )
    .bind(...categoryIds, limit)
    .all<StatsRow & { category_id: string; category_rank: number }>();

  for (const id of categoryIds) grouped[id] = [];
  for (const row of results) (grouped[row.category_id] ??= []).push(mapStatsRow(row));
  return grouped;
}

export async function listFlashcardSetsByCategoryPaginated(
  categoryId: string,
  page = 1,
  pageSize = 25
): Promise<{ sets: FlashcardSetWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);
  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT ${STATS_SELECT}
         WHERE c.id = ? AND fs.visibility = 'public' AND fs.status = 'published'
         ORDER BY fs.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(categoryId, pageSize, offset)
      .all<StatsRow>(),
    db
      .prepare(
        `SELECT COUNT(*) as total FROM flashcard_sets fs
         JOIN subcategories s ON s.id = fs.subcategory_id
         JOIN categories c ON c.id = s.category_id
         WHERE c.id = ? AND fs.visibility = 'public' AND fs.status = 'published'`
      )
      .bind(categoryId)
      .first<{ total: number }>(),
  ]);
  return { sets: results.map(mapStatsRow), total: countRow?.total ?? 0, page, pageSize };
}

export async function listFlashcardSetsBySubcategory(subcategoryId: string, limit?: number): Promise<FlashcardSetWithStats[]> {
  const db = getDb();
  const query = `SELECT ${STATS_SELECT}
       WHERE fs.subcategory_id = ? AND fs.visibility = 'public' AND fs.status = 'published'
       ORDER BY fs.updated_at DESC${limit ? ' LIMIT ?' : ''}`;
  const stmt = limit ? db.prepare(query).bind(subcategoryId, limit) : db.prepare(query).bind(subcategoryId);
  const { results } = await stmt.all<StatsRow>();
  return results.map(mapStatsRow);
}

export async function listFlashcardSetsByCreator(creatorId: string): Promise<FlashcardSetWithStats[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT ${STATS_SELECT}
       WHERE fs.creator_id = ?
       ORDER BY fs.updated_at DESC`
    )
    .bind(creatorId)
    .all<StatsRow>();
  return results.map(mapStatsRow);
}

/**
 * Public-only aggregate for a creator's profile card: how many public
 * flashcard sets they have and how many completed study sessions those
 * sets have received. Never counts private/draft sets.
 */
export async function getPublicFlashcardStatsByCreator(
  creatorId: string
): Promise<{ setCount: number; totalAttempts: number }> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM flashcard_sets WHERE creator_id = ? AND visibility = 'public') AS set_count,
        (SELECT COUNT(*) FROM flashcard_attempts fa
           JOIN flashcard_sets fs ON fs.id = fa.set_id
          WHERE fs.creator_id = ? AND fs.visibility = 'public') AS attempt_count`
    )
    .bind(creatorId, creatorId)
    .first<{ set_count: number; attempt_count: number }>();
  return { setCount: row?.set_count ?? 0, totalAttempts: row?.attempt_count ?? 0 };
}

export async function adminListAllFlashcardSets(
  page = 1,
  pageSize = 25
): Promise<{ sets: FlashcardSetWithStats[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);
  const [{ results }, countRow] = await Promise.all([
    db
      .prepare(`SELECT ${STATS_SELECT} ORDER BY fs.created_at DESC LIMIT ? OFFSET ?`)
      .bind(pageSize, offset)
      .all<StatsRow>(),
    db.prepare('SELECT COUNT(*) as total FROM flashcard_sets').first<{ total: number }>(),
  ]);
  return { sets: results.map(mapStatsRow), total: countRow?.total ?? 0, page, pageSize };
}
