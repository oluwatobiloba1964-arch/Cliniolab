// File: src/lib/db/services/abbreviationService.ts
import { getDb, generateId, nowIso } from '@/lib/db/client';
import { normalizeForDedup } from '@/lib/utils/normalizeText';
import type { MedicalAbbreviation } from '@/types';

interface AbbreviationRow {
  id: string;
  abbreviation: string;
  meaning: string;
  category: string | null;
  is_glossary: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapAbbreviation(row: AbbreviationRow): MedicalAbbreviation {
  return {
    id: row.id,
    abbreviation: row.abbreviation,
    meaning: row.meaning,
    category: row.category,
    isGlossary: row.is_glossary === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type Kind = 'abbreviation' | 'glossary' | 'all';

function kindWhere(kind: Kind): string {
  if (kind === 'all') return '';
  return `is_glossary = ${kind === 'glossary' ? 1 : 0}`;
}

/**
 * All entries, alphabetical — used by both the full page and homepage
 * widget (sliced/paginated by the caller). `kind` narrows to just
 * abbreviations, just glossary terms, or 'all' (default).
 */
export async function listAbbreviations(search?: string, kind: Kind = 'all'): Promise<MedicalAbbreviation[]> {
  const db = getDb();
  const kc = kindWhere(kind);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const where = [kc, '(abbreviation LIKE ? OR meaning LIKE ?)'].filter(Boolean).join(' AND ');
    const { results } = await db
      .prepare(`SELECT * FROM medical_abbreviations WHERE ${where} ORDER BY abbreviation ASC`)
      .bind(term, term)
      .all<AbbreviationRow>();
    return results.map(mapAbbreviation);
  }
  const where = kc ? ` WHERE ${kc}` : '';
  const { results } = await db
    .prepare(`SELECT * FROM medical_abbreviations${where} ORDER BY abbreviation ASC`)
    .all<AbbreviationRow>();
  return results.map(mapAbbreviation);
}

/** Total count for a given kind/search — powers page-numbered pagination on the full listing page. */
export async function countAbbreviations(search?: string, kind: Kind = 'all'): Promise<number> {
  const db = getDb();
  const kc = kindWhere(kind);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const where = [kc, '(abbreviation LIKE ? OR meaning LIKE ?)'].filter(Boolean).join(' AND ');
    const row = await db
      .prepare(`SELECT COUNT(*) as count FROM medical_abbreviations WHERE ${where}`)
      .bind(term, term)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }
  const where = kc ? ` WHERE ${kc}` : '';
  const row = await db
    .prepare(`SELECT COUNT(*) as count FROM medical_abbreviations${where}`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** One page of entries, alphabetical — used by the full /abbreviations listing page. */
export async function listAbbreviationsPage(
  page: number,
  pageSize: number,
  search?: string,
  kind: Kind = 'all'
): Promise<MedicalAbbreviation[]> {
  const db = getDb();
  const offset = Math.max(0, (page - 1) * pageSize);
  const kc = kindWhere(kind);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const where = [kc, '(abbreviation LIKE ? OR meaning LIKE ?)'].filter(Boolean).join(' AND ');
    const { results } = await db
      .prepare(`SELECT * FROM medical_abbreviations WHERE ${where} ORDER BY abbreviation ASC LIMIT ? OFFSET ?`)
      .bind(term, term, pageSize, offset)
      .all<AbbreviationRow>();
    return results.map(mapAbbreviation);
  }
  const where = kc ? ` WHERE ${kc}` : '';
  const { results } = await db
    .prepare(`SELECT * FROM medical_abbreviations${where} ORDER BY abbreviation ASC LIMIT ? OFFSET ?`)
    .bind(pageSize, offset)
    .all<AbbreviationRow>();
  return results.map(mapAbbreviation);
}

/** A handful of random entries for the homepage teaser widget. Mixes abbreviations and glossary terms unless narrowed. */
export async function listRandomAbbreviations(limit = 5, kind: Kind = 'all'): Promise<MedicalAbbreviation[]> {
  // Avoids ORDER BY RANDOM(), which reads the whole table on every call (costly on D1).
  // Instead we pick a random starting rowid and read forward from it, wrapping around
  // to the start if needed. Reads only about `limit` rows per call.
  const db = getDb();
  const where = kindWhere(kind);
  const andWhere = where ? ` AND ${where}` : '';

  const maxRow = await db
    .prepare('SELECT MAX(rowid) AS max_rowid FROM medical_abbreviations')
    .first<{ max_rowid: number | null }>();
  const maxRowid = maxRow?.max_rowid ?? 0;
  if (maxRowid <= 0) return [];

  const start = Math.floor(Math.random() * maxRowid) + 1;

  const { results: tail } = await db
    .prepare(`SELECT * FROM medical_abbreviations WHERE rowid >= ?${andWhere} ORDER BY rowid LIMIT ?`)
    .bind(start, limit)
    .all<AbbreviationRow>();

  let rows = tail;
  if (rows.length < limit) {
    const { results: head } = await db
      .prepare(`SELECT * FROM medical_abbreviations WHERE rowid < ?${andWhere} ORDER BY rowid LIMIT ?`)
      .bind(start, limit - rows.length)
      .all<AbbreviationRow>();
    rows = [...rows, ...head];
  }

  return rows.map(mapAbbreviation);
}

export async function createAbbreviation(
  createdBy: string,
  input: { abbreviation: string; meaning: string; category?: string; isGlossary?: boolean }
): Promise<MedicalAbbreviation> {
  const db = getDb();
  const id = generateId('abbr');
  const now = nowIso();
  const isGlossary = input.isGlossary ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO medical_abbreviations (id, abbreviation, meaning, category, is_glossary, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.abbreviation.trim(),
      input.meaning.trim(),
      input.category?.trim() || null,
      isGlossary,
      createdBy,
      now,
      now
    )
    .run();
  return {
    id,
    abbreviation: input.abbreviation.trim(),
    meaning: input.meaning.trim(),
    category: input.category?.trim() || null,
    isGlossary: isGlossary === 1,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAbbreviation(
  id: string,
  input: { abbreviation: string; meaning: string; category?: string; isGlossary?: boolean }
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      'UPDATE medical_abbreviations SET abbreviation = ?, meaning = ?, category = ?, is_glossary = ?, updated_at = ? WHERE id = ?'
    )
    .bind(
      input.abbreviation.trim(),
      input.meaning.trim(),
      input.category?.trim() || null,
      input.isGlossary ? 1 : 0,
      nowIso(),
      id
    )
    .run();
}

export async function deleteAbbreviation(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM medical_abbreviations WHERE id = ?').bind(id).run();
}

/**
 * Existence check used by bulk upload to report/skip duplicates before
 * import. Scoped by kind so an abbreviation and a glossary term can share
 * the same text without colliding.
 *
 * Matching is done on the *normalized* form (see normalizeForDedup) rather
 * than a plain lowercase compare, so "ACE Inhibitor", "ace-inhibitor", and
 * "ACE  Inhibitor." are all recognized as the same entry — this is what
 * let visible duplicates like the doubled "ACE Inhibitor" / "Contamination"
 * rows slip through before.
 *
 * D1 caps bound parameters at 100 per statement, so instead of a targeted
 * IN (...) query per term (which breaks past ~99 terms), this pulls all
 * existing terms of the given kind once and compares in memory. Abbreviation
 * tables are small enough (low thousands of rows) that this is cheap and
 * avoids the parameter-limit problem entirely.
 */
export async function findExistingAbbreviationTerms(
  terms: string[],
  kind: 'abbreviation' | 'glossary' = 'abbreviation'
): Promise<Set<string>> {
  if (terms.length === 0) return new Set();
  const db = getDb();

  const { results } = await db
    .prepare('SELECT abbreviation FROM medical_abbreviations WHERE is_glossary = ?')
    .bind(kind === 'glossary' ? 1 : 0)
    .all<{ abbreviation: string }>();

  const existingNormalized = new Set(results.map((r) => normalizeForDedup(r.abbreviation)));
  const found = new Set<string>();
  for (const term of terms) {
    const key = normalizeForDedup(term);
    if (existingNormalized.has(key)) found.add(term.toLowerCase());
  }
  return found;
}

/**
 * Inserts many entries at once (abbreviations or glossary terms, per the
 * `isGlossary` flag on each entry). Callers are expected to have already
 * filtered out duplicates (see findExistingAbbreviationTerms) — this just
 * inserts whatever it's given, one row per entry.
 */
export async function createAbbreviationsBulk(
  createdBy: string,
  entries: { abbreviation: string; meaning: string; category?: string; isGlossary?: boolean }[]
): Promise<MedicalAbbreviation[]> {
  const db = getDb();
  const now = nowIso();
  const created: MedicalAbbreviation[] = [];

  const statements = entries.map((entry) => {
    const id = generateId('abbr');
    const abbreviation = entry.abbreviation.trim();
    const meaning = entry.meaning.trim();
    const category = entry.category?.trim() || null;
    const isGlossary = entry.isGlossary ? 1 : 0;
    created.push({
      id,
      abbreviation,
      meaning,
      category,
      isGlossary: isGlossary === 1,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return db
      .prepare(
        `INSERT INTO medical_abbreviations (id, abbreviation, meaning, category, is_glossary, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, abbreviation, meaning, category, isGlossary, createdBy, now, now);
  });

  if (statements.length > 0) {
    await db.batch(statements);
  }

  return created;
}
