// File: src/lib/db/services/searchService.ts
// Full-text search (FTS5) upgrade — drop-in replacement, same public shape.
//
// REQUIRES this one-time migration (also shipped as db/migrations/000X_search_fts.sql):
//
//   CREATE VIRTUAL TABLE IF NOT EXISTS quizzes_fts     USING fts5(title, description);
//   CREATE VIRTUAL TABLE IF NOT EXISTS blog_posts_fts  USING fts5(title, content);
//   CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts   USING fts5(title, description);
//
//   -- Backfill existing rows (rowid lines up with the base tables' implicit rowid)
//   INSERT INTO quizzes_fts(rowid, title, description)
//     SELECT rowid, title, COALESCE(description, '') FROM quizzes;
//   INSERT INTO blog_posts_fts(rowid, title, content)
//     SELECT rowid, title, COALESCE(content, '') FROM blog_posts;
//   INSERT INTO resources_fts(rowid, title, description)
//     SELECT rowid, title, COALESCE(description, '') FROM resources;
//
//   -- Keep the FTS index in sync on every write
//   CREATE TRIGGER IF NOT EXISTS quizzes_fts_ai AFTER INSERT ON quizzes BEGIN
//     INSERT INTO quizzes_fts(rowid, title, description) VALUES (new.rowid, new.title, COALESCE(new.description, ''));
//   END;
//   CREATE TRIGGER IF NOT EXISTS quizzes_fts_ad AFTER DELETE ON quizzes BEGIN
//     INSERT INTO quizzes_fts(quizzes_fts, rowid, title, description) VALUES('delete', old.rowid, old.title, COALESCE(old.description, ''));
//   END;
//   CREATE TRIGGER IF NOT EXISTS quizzes_fts_au AFTER UPDATE ON quizzes BEGIN
//     INSERT INTO quizzes_fts(quizzes_fts, rowid, title, description) VALUES('delete', old.rowid, old.title, COALESCE(old.description, ''));
//     INSERT INTO quizzes_fts(rowid, title, description) VALUES (new.rowid, new.title, COALESCE(new.description, ''));
//   END;
//   -- (same trigger trio for blog_posts_fts and resources_fts)
//
// Until the migration runs, every function below transparently falls back
// to the original LIKE-based queries, so this file is safe to deploy first.
import { getDb } from '@/lib/db/client';
import type { QuizWithStats, BlogPost, Resource } from '@/types';

export interface SearchSuggestion {
  id: string;
  title: string;
  type: 'quiz' | 'article' | 'resource';
  url: string;
}

export interface SearchResults {
  quizzes: Pick<QuizWithStats, 'id' | 'title' | 'description' | 'difficulty' | 'mode'>[];
  posts: Pick<BlogPost, 'id' | 'title' | 'slug' | 'category'>[];
  resources: Pick<Resource, 'id' | 'title' | 'description' | 'kind'>[];
}

/**
 * Turn raw user input into a safe FTS5 MATCH expression: every special
 * character is stripped, each remaining token is quoted (so it can't
 * inject FTS5 syntax like OR/NOT/NEAR), and a trailing * enables
 * prefix matching, which is what makes typeahead feel instant.
 */
function toFtsQuery(query: string): string | null {
  const cleaned = query.replace(/["'()*:\-]/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned
    .split(/\s+/)
    .map((token) => `"${token}"`)
    .join(' ') + ' *';
}

interface QuizHit { id: string; title: string; description: string | null; difficulty: string; mode: string }
interface PostHit { id: string; title: string; slug: string; category: string | null }
interface ResourceHit { id: string; title: string; description: string | null; kind: string }

async function searchQuizzesFts(ftsQuery: string): Promise<QuizHit[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT q.id, q.title, q.description, q.difficulty, q.mode
       FROM quizzes_fts f JOIN quizzes q ON q.rowid = f.rowid
       WHERE quizzes_fts MATCH ? AND q.visibility = 'public' AND q.status = 'published'
       ORDER BY rank
       LIMIT 10`
    )
    .bind(ftsQuery)
    .all<QuizHit>();
  return results ?? [];
}

async function searchQuizzesLike(query: string): Promise<QuizHit[]> {
  const db = getDb();
  const like = `%${query}%`;
  const { results } = await db
    .prepare(
      `SELECT id, title, description, difficulty, mode FROM quizzes
       WHERE visibility = 'public' AND status = 'published' AND (title LIKE ? OR description LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<QuizHit>();
  return results ?? [];
}

async function searchPostsFts(ftsQuery: string): Promise<PostHit[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.slug, p.category
       FROM blog_posts_fts f JOIN blog_posts p ON p.rowid = f.rowid
       WHERE blog_posts_fts MATCH ? AND p.status = 'published'
       ORDER BY rank
       LIMIT 10`
    )
    .bind(ftsQuery)
    .all<PostHit>();
  return results ?? [];
}

async function searchPostsLike(query: string): Promise<PostHit[]> {
  const db = getDb();
  const like = `%${query}%`;
  const { results } = await db
    .prepare(
      `SELECT id, title, slug, category FROM blog_posts
       WHERE status = 'published' AND (title LIKE ? OR content LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<PostHit>();
  return results ?? [];
}

async function searchResourcesFts(ftsQuery: string): Promise<ResourceHit[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT r.id, r.title, r.description, r.kind
       FROM resources_fts f JOIN resources r ON r.rowid = f.rowid
       WHERE resources_fts MATCH ? AND r.status = 'published'
       ORDER BY rank
       LIMIT 10`
    )
    .bind(ftsQuery)
    .all<ResourceHit>();
  return results ?? [];
}

async function searchResourcesLike(query: string): Promise<ResourceHit[]> {
  const db = getDb();
  const like = `%${query}%`;
  const { results } = await db
    .prepare(
      `SELECT id, title, description, kind FROM resources
       WHERE status = 'published' AND (title LIKE ? OR description LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<ResourceHit>();
  return results ?? [];
}

/**
 * Ranked full-text search across the three main content types, backed by
 * D1's FTS5 virtual tables. Falls back to the original LIKE-based scan if
 * the FTS tables don't exist yet (pre-migration deploys) or if the query
 * can't be expressed in FTS5 syntax.
 */
export async function searchSite(query: string): Promise<SearchResults> {
  const ftsQuery = toFtsQuery(query);

  const [quizzes, posts, resources] = await Promise.all([
    runWithFallback(ftsQuery, () => searchQuizzesFts(ftsQuery!), () => searchQuizzesLike(query)),
    runWithFallback(ftsQuery, () => searchPostsFts(ftsQuery!), () => searchPostsLike(query)),
    runWithFallback(ftsQuery, () => searchResourcesFts(ftsQuery!), () => searchResourcesLike(query)),
  ]);

  return {
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty as QuizWithStats['difficulty'],
      mode: q.mode as QuizWithStats['mode'],
    })),
    posts: posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, category: p.category })),
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      kind: r.kind as Resource['kind'],
    })),
  };
}

/**
 * Lightweight typeahead search. Still one UNION query = one D1 round-trip,
 * but now each branch matches against its FTS index with prefix matching
 * instead of scanning the base tables with a leading-wildcard LIKE.
 */
export async function suggestSite(query: string): Promise<SearchSuggestion[]> {
  const db = getDb();
  const ftsQuery = toFtsQuery(query);

  if (ftsQuery) {
    try {
      const { results } = await db
        .prepare(
          `SELECT id, title, type, url FROM (
             SELECT q.id, q.title, 'quiz' AS type, '/quizzes/' || q.id AS url
             FROM quizzes_fts f JOIN quizzes q ON q.rowid = f.rowid
             WHERE quizzes_fts MATCH ? AND q.visibility = 'public' AND q.status = 'published'
             ORDER BY rank LIMIT 5
           )
           UNION ALL
           SELECT id, title, type, url FROM (
             SELECT p.id, p.title, 'article' AS type, '/blog/' || p.slug AS url
             FROM blog_posts_fts f JOIN blog_posts p ON p.rowid = f.rowid
             WHERE blog_posts_fts MATCH ? AND p.status = 'published'
             ORDER BY rank LIMIT 5
           )
           UNION ALL
           SELECT id, title, type, url FROM (
             SELECT r.id, r.title, 'resource' AS type, '/resources' AS url
             FROM resources_fts f JOIN resources r ON r.rowid = f.rowid
             WHERE resources_fts MATCH ? AND r.status = 'published'
             ORDER BY rank LIMIT 5
           )
           LIMIT 8`
        )
        .bind(ftsQuery, ftsQuery, ftsQuery)
        .all<SearchSuggestion>();
      return results ?? [];
    } catch {
      // FTS tables not migrated yet — fall through to LIKE below.
    }
  }

  const like = `%${query}%`;
  const { results } = await db.prepare(`
    SELECT id, title, type, url FROM (
      SELECT id, title, 'quiz' AS type, '/quizzes/' || id AS url
      FROM quizzes
      WHERE visibility = 'public' AND status = 'published' AND (title LIKE ? OR description LIKE ?)
      LIMIT 5
    )
    UNION ALL
    SELECT id, title, type, url FROM (
      SELECT id, title, 'article' AS type, '/blog/' || slug AS url
      FROM blog_posts
      WHERE status = 'published' AND (title LIKE ? OR content LIKE ?)
      LIMIT 5
    )
    UNION ALL
    SELECT id, title, type, url FROM (
      SELECT id, title, 'resource' AS type, '/resources' AS url
      FROM resources
      WHERE status = 'published' AND (title LIKE ? OR description LIKE ?)
      LIMIT 5
    )
    LIMIT 8
  `).bind(like, like, like, like, like, like).all<SearchSuggestion>();

  return results ?? [];
}

/** Run the FTS variant; if it throws (tables missing), use the LIKE fallback. */
async function runWithFallback<T>(
  ftsQuery: string | null,
  fts: () => Promise<T[]>,
  like: () => Promise<T[]>,
): Promise<T[]> {
  if (ftsQuery) {
    try {
      return await fts();
    } catch {
      // FTS tables not migrated yet — fall back to the scan.
    }
  }
  return like();
}

// ---------------------------------------------------------------------
// App-level FTS sync for blog_posts.
//
// The DB triggers (blog_posts_fts_ai/ad/au) that used to keep
// blog_posts_fts in sync were dropped — on this D1 database they threw
// "SQL logic error: SQLITE_ERROR" on every UPDATE/DELETE to blog_posts,
// blocking the admin Edit/Delete post actions entirely. D1's FTS5
// triggers are known to be unreliable against TEXT PRIMARY KEY tables
// (relies on the hidden rowid lining up), so indexing is now done here
// instead, right after each successful write in cmsService.
//
// Each function is a no-op-on-failure: search indexing must never be
// the reason a post save/delete fails, so every call is wrapped and
// errors are swallowed (logged) rather than thrown.

export async function indexPostInsert(id: string, title: string, content: string): Promise<void> {
  const db = getDb();
  try {
    const row = await db.prepare('SELECT rowid AS rid FROM blog_posts WHERE id = ?').bind(id).first<{ rid: number }>();
    if (!row) return;
    await db
      .prepare('INSERT INTO blog_posts_fts(rowid, title, content) VALUES (?, ?, ?)')
      .bind(row.rid, title, content ?? '')
      .run();
  } catch (err) {
    console.error('FTS index insert failed for post', id, err);
  }
}

export async function indexPostUpdate(id: string, title: string, content: string): Promise<void> {
  const db = getDb();
  try {
    const row = await db.prepare('SELECT rowid AS rid FROM blog_posts WHERE id = ?').bind(id).first<{ rid: number }>();
    if (!row) return;
    // Plain (non-external-content) FTS5 table: re-indexing a rowid is a
    // straight delete-then-insert, no need to know the previous text.
    await db.prepare('DELETE FROM blog_posts_fts WHERE rowid = ?').bind(row.rid).run();
    await db
      .prepare('INSERT INTO blog_posts_fts(rowid, title, content) VALUES (?, ?, ?)')
      .bind(row.rid, title, content ?? '')
      .run();
  } catch (err) {
    console.error('FTS index update failed for post', id, err);
  }
}

export async function indexPostDelete(rowid: number): Promise<void> {
  const db = getDb();
  try {
    await db.prepare('DELETE FROM blog_posts_fts WHERE rowid = ?').bind(rowid).run();
  } catch (err) {
    console.error('FTS index delete failed for rowid', rowid, err);
  }
}
