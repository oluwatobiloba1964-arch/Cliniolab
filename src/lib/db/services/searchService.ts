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

interface QuizHit { id: string; title: string; description: string | null; difficulty: string; mode: string }
interface PostHit { id: string; title: string; slug: string; category: string | null }
interface ResourceHit { id: string; title: string; description: string | null; kind: string }

export async function searchSite(query: string): Promise<SearchResults> {
  const db = getDb();
  const like = `%${query.trim()}%`;

  const [quizzes, posts, resources] = await Promise.all([
    db
      .prepare(
        `SELECT id, title, description, difficulty, mode FROM quizzes
         WHERE visibility = 'public' AND status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 10`,
      )
      .bind(like)
      .all<QuizHit>(),
    db
      .prepare(
        `SELECT id, title, slug, category FROM blog_posts
         WHERE status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 10`,
      )
      .bind(like)
      .all<PostHit>(),
    db
      .prepare(
        `SELECT id, title, description, kind FROM resources
         WHERE status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 10`,
      )
      .bind(like)
      .all<ResourceHit>(),
  ]);

  return {
    quizzes: (quizzes.results ?? []).map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty as QuizWithStats['difficulty'],
      mode: q.mode as QuizWithStats['mode'],
    })),
    posts: (posts.results ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
    })),
    resources: (resources.results ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      kind: r.kind as Resource['kind'],
    })),
  };
}

export async function suggestSite(query: string): Promise<SearchSuggestion[]> {
  const db = getDb();
  const like = `%${query.trim()}%`;

  const { results } = await db
    .prepare(
      `SELECT id, title, type, url FROM (
         SELECT id, title, 'quiz' AS type, '/quizzes/' || id AS url
         FROM quizzes
         WHERE visibility = 'public' AND status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 5
       )
       UNION ALL
       SELECT id, title, type, url FROM (
         SELECT id, title, 'article' AS type, '/blog/' || slug AS url
         FROM blog_posts
         WHERE status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 5
       )
       UNION ALL
       SELECT id, title, type, url FROM (
         SELECT id, title, 'resource' AS type, '/resources' AS url
         FROM resources
         WHERE status = 'published' AND title LIKE ?
         ORDER BY title LIMIT 5
       )
       LIMIT 8`,
    )
    .bind(like, like, like)
    .all<SearchSuggestion>();

  return results ?? [];
}

// No-op stubs — kept so cmsService imports don't break
export async function indexPostInsert(_id: string, _title: string, _content: string): Promise<void> {}
export async function indexPostUpdate(_id: string, _title: string, _content: string): Promise<void> {}
export async function indexPostDelete(_rowid: number): Promise<void> {}
