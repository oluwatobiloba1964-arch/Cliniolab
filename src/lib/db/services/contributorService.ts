import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Contributor, ContributorInput } from '@/types';

interface ContributorRow {
  id: string;
  slug: string;
  name: string;
  credentials: string | null;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapContributor(row: ContributorRow): Contributor {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    credentials: row.credentials,
    title: row.title,
    bio: row.bio,
    photoUrl: row.photo_url,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = getDb();
  const root = base || 'contributor';
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    const row = await db
      .prepare('SELECT id FROM contributors WHERE slug = ?')
      .bind(candidate)
      .first<{ id: string }>();
    if (!row || row.id === excludeId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${generateId('c').slice(-6)}`;
}

function clean(value: string | undefined | null, max: number): string | null {
  const v = (value ?? '').trim();
  return v ? v.slice(0, max) : null;
}

export async function listContributors(opts: { activeOnly?: boolean } = {}): Promise<Contributor[]> {
  const db = getDb();
  const sql = opts.activeOnly
    ? 'SELECT * FROM contributors WHERE is_active = 1 ORDER BY name COLLATE NOCASE ASC'
    : 'SELECT * FROM contributors ORDER BY name COLLATE NOCASE ASC';
  const { results } = await db.prepare(sql).all<ContributorRow>();
  return results.map(mapContributor);
}

export async function getContributorById(id: string): Promise<Contributor | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  return row ? mapContributor(row) : null;
}

export async function getContributorBySlug(slug: string): Promise<Contributor | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM contributors WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first<ContributorRow>();
  return row ? mapContributor(row) : null;
}

export async function createContributor(input: ContributorInput): Promise<Contributor> {
  const name = clean(input.name, 120);
  if (!name) throw new Error('Name is required');
  const db = getDb();
  const id = generateId('contrib');
  const slug = await uniqueSlug(slugify(name));
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO contributors (id, slug, name, credentials, title, bio, photo_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      slug,
      name,
      clean(input.credentials, 160),
      clean(input.title, 160),
      clean(input.bio, 1500),
      clean(input.photoUrl, 500),
      input.isActive === false ? 0 : 1,
      now,
      now
    )
    .run();
  const created = await getContributorById(id);
  if (!created) throw new Error('Failed to create contributor');
  return created;
}

export async function updateContributor(id: string, input: ContributorInput): Promise<Contributor> {
  const existing = await getContributorById(id);
  if (!existing) throw new Error('Contributor not found');
  const name = clean(input.name, 120);
  if (!name) throw new Error('Name is required');
  const db = getDb();
  // Slug follows the name only when the name actually changed, so shared
  // author-page links keep working across unrelated edits.
  const slug = name === existing.name ? existing.slug : await uniqueSlug(slugify(name), id);
  await db
    .prepare(
      `UPDATE contributors SET slug = ?, name = ?, credentials = ?, title = ?, bio = ?, photo_url = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      slug,
      name,
      clean(input.credentials, 160),
      clean(input.title, 160),
      clean(input.bio, 1500),
      clean(input.photoUrl, 500),
      input.isActive === false ? 0 : 1,
      nowIso(),
      id
    )
    .run();
  const updated = await getContributorById(id);
  if (!updated) throw new Error('Failed to update contributor');
  return updated;
}

/**
 * Deleting a contributor never touches posts: each post keeps its own copy
 * of the byline text. Only the link to the author page is dropped.
 */
export async function deleteContributor(id: string): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('UPDATE blog_posts SET author_contributor_id = NULL WHERE author_contributor_id = ?').bind(id),
    db.prepare('UPDATE blog_posts SET reviewer_contributor_id = NULL WHERE reviewer_contributor_id = ?').bind(id),
    db.prepare('DELETE FROM contributors WHERE id = ?').bind(id),
  ]);
}

export async function countPostsByContributor(id: string): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare(
      "SELECT COUNT(*) as c FROM blog_posts WHERE status = 'published' AND (author_contributor_id = ? OR reviewer_contributor_id = ?)"
    )
    .bind(id, id)
    .first<{ c: number }>();
  return row?.c ?? 0;
}
