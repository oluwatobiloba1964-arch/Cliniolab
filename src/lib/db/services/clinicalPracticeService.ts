// File: src/lib/db/services/clinicalPracticeService.ts
import { getDb } from '@/lib/db/client';
import { getLagosDateString } from '@/lib/db/services/dailyQuizService';

/**
 * Daily Clinical Practice (cases, calculations, OSCE stations).
 *
 * Deterministic, not stored per day: given today's Lagos date string and
 * the full active item bank (one small SELECT), each kind's pool is
 * sorted into a stable order and a date-hash picks which slice to serve,
 * exactly like dailyQuizService's quiz pick. Same inputs always produce
 * the same picks for a given day, so there is nothing to write - no
 * history table, no cron. The client additionally caches the response in
 * localStorage for the day, so most visits don't even reach this query.
 */

export type ClinicalPracticeKind = 'case' | 'calculation' | 'osce';

export interface CaseOption { label: string; correct: boolean; feedback: string }
export interface ClinicalCase { id: string; title: string; setting: string; prompt: string; options: CaseOption[]; keyPoint: string }
export interface ClinicalCalculation { id: string; prompt: string; answer: number; tolerance: number; unit: string; explanation: string }
export interface OsceStation { id: string; title: string; steps: string[] }

export interface DailyClinicalPracticeSet {
  date: string; // YYYY-MM-DD, Africa/Lagos
  cases: ClinicalCase[];
  calculations: ClinicalCalculation[];
  osceStations: OsceStation[];
}

interface ItemRow {
  id: string;
  kind: ClinicalPracticeKind;
  payload: string;
}

const COUNTS: Record<ClinicalPracticeKind, number> = {
  case: 5,
  calculation: 5,
  osce: 3,
};

function hashDateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic daily slice: rotate a stably-sorted pool by a date-derived offset, then take `count`. */
function pickForDay<T>(pool: T[], dateStr: string, salt: string, count: number): T[] {
  if (pool.length === 0) return [];
  const seed = hashDateToSeed(`${dateStr}:${salt}`);
  const n = pool.length;
  const start = seed % n;
  const picked: T[] = [];
  for (let i = 0; i < Math.min(count, n); i++) {
    picked.push(pool[(start + i) % n]);
  }
  return picked;
}

async function getActiveItems(kind: ClinicalPracticeKind): Promise<ItemRow[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT id, kind, payload FROM clinical_practice_items WHERE kind = ? AND is_active = 1 ORDER BY id ASC')
    .bind(kind)
    .all<ItemRow>();
  return results;
}

/** Today's Clinical Practice set (Africa/Lagos day). Same set all day; changes at local midnight. */
export async function getTodaysPracticeSet(now: Date = new Date()): Promise<DailyClinicalPracticeSet> {
  const date = getLagosDateString(now);

  const [caseRows, calcRows, osceRows] = await Promise.all([
    getActiveItems('case'),
    getActiveItems('calculation'),
    getActiveItems('osce'),
  ]);

  const cases = pickForDay(caseRows, date, 'case', COUNTS.case).map((row) => {
    const payload = JSON.parse(row.payload) as Omit<ClinicalCase, 'id'>;
    return { id: row.id, ...payload };
  });
  const calculations = pickForDay(calcRows, date, 'calculation', COUNTS.calculation).map((row) => {
    const payload = JSON.parse(row.payload) as Omit<ClinicalCalculation, 'id'>;
    return { id: row.id, ...payload };
  });
  const osceStations = pickForDay(osceRows, date, 'osce', COUNTS.osce).map((row) => {
    const payload = JSON.parse(row.payload) as Omit<OsceStation, 'id'>;
    return { id: row.id, ...payload };
  });

  return { date, cases, calculations, osceStations };
}

// ---------- Admin bulk upload ----------

export type NewCaseDraft = Omit<ClinicalCase, 'id'>;
export type NewCalculationDraft = Omit<ClinicalCalculation, 'id'>;
export type NewOsceDraft = Omit<OsceStation, 'id'>;
export type NewItemDraft = NewCaseDraft | NewCalculationDraft | NewOsceDraft;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Lists ids already in the bank for a kind, so bulk-upload can report duplicates instead of silently overwriting. */
export async function listItemIds(kind: ClinicalPracticeKind): Promise<Set<string>> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT id FROM clinical_practice_items WHERE kind = ?')
    .bind(kind)
    .all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}

/**
 * Inserts many items of one kind at once (admin bulk upload). Each draft's
 * title/prompt is slugified into a stable id prefixed by kind; a numeric
 * suffix is added on collision within the same batch. Returns the ids
 * created, in order.
 */
export async function createItemsBulk(kind: ClinicalPracticeKind, drafts: NewItemDraft[]): Promise<string[]> {
  if (drafts.length === 0) return [];
  const db = getDb();
  const existing = await listItemIds(kind);
  const createdIds: string[] = [];

  const statements = drafts.map((draft) => {
    const base = 'title' in draft ? draft.title : draft.prompt;
    let id = `${kind}-${slugify(base) || Math.random().toString(36).slice(2, 8)}`;
    let suffix = 2;
    while (existing.has(id)) {
      id = `${kind}-${slugify(base)}-${suffix}`;
      suffix++;
    }
    existing.add(id);
    createdIds.push(id);
    return db
      .prepare('INSERT INTO clinical_practice_items (id, kind, payload) VALUES (?, ?, ?)')
      .bind(id, kind, JSON.stringify(draft));
  });

  await db.batch(statements);
  return createdIds;
}
