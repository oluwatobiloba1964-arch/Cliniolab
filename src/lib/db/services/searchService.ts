// File: src/lib/db/services/searchService.ts
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
 * Simple LIKE-based search across the three main content types. Good
 * enough at Cliniolab's current scale; if content volume grows large
 * enough to need ranked full-text search, D1's FTS5 virtual tables would
 * be the next step without changing this service's public shape.
 */
export async function searchSite(query: string): Promise<SearchResults> {
  const db = getDb();
  const like = `%${query}%`;

  const { results: quizzes } = await db
    .prepare(
      `SELECT id, title, description, difficulty, mode FROM quizzes
       WHERE visibility = 'public' AND status = 'published' AND (title LIKE ? OR description LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<{ id: string; title: string; description: string | null; difficulty: string; mode: string }>();

  const { results: posts } = await db
    .prepare(
      `SELECT id, title, slug, category FROM blog_posts
       WHERE status = 'published' AND (title LIKE ? OR content LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<{ id: string; title: string; slug: string; category: string | null }>();

  const { results: resources } = await db
    .prepare(
      `SELECT id, title, description, kind FROM resources
       WHERE status = 'published' AND (title LIKE ? OR description LIKE ?)
       LIMIT 10`
    )
    .bind(like, like)
    .all<{ id: string; title: string; description: string | null; kind: string }>();

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
 * Lightweight typeahead search. One UNION query keeps suggestions to a
 * single D1 round-trip even though they come from three content tables.
 */
export async function suggestSite(query: string): Promise<SearchSuggestion[]> {
  const db = getDb();
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

  return results;
}
