import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { BlogContentFormat, BlogPost, BlogStatus, StaticPage } from '@/types';

interface BlogRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  content: string;
  content_format: string;
  excerpt: string | null;
  category: string | null;
  blog_category_id: string | null;
  blog_subcategory_id: string | null;
  featured_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  is_sponsored: number;
  is_pinned: number;
  full_width: number;
  send_as_newsletter: number;
  newsletter_sent_at: string | null;
  send_push: number;
  push_sent_at: string | null;
  author_name?: string | null;
  author_credentials?: string | null;
  author_photo_url?: string | null;
  author_contributor_id?: string | null;
  reviewer_name?: string | null;
  reviewer_credentials?: string | null;
  reviewer_photo_url?: string | null;
  reviewer_contributor_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface PageRow {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

function mapBlog(row: BlogRow): BlogPost {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    contentFormat: row.content_format === 'html' ? 'html' : 'markdown',
    excerpt: row.excerpt,
    category: row.category,
    blogCategoryId: row.blog_category_id,
    blogSubcategoryId: row.blog_subcategory_id,
    featuredImageUrl: row.featured_image_url,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status as BlogStatus,
    isSponsored: row.is_sponsored === 1,
    isPinned: row.is_pinned === 1,
    fullWidth: row.full_width === 1,
    sendAsNewsletter: row.send_as_newsletter === 1,
    newsletterSentAt: row.newsletter_sent_at,
    sendPush: row.send_push === 1,
    pushSentAt: row.push_sent_at,
    authorName: row.author_name ?? null,
    authorCredentials: row.author_credentials ?? null,
    authorPhotoUrl: row.author_photo_url ?? null,
    authorContributorId: row.author_contributor_id ?? null,
    reviewerName: row.reviewer_name ?? null,
    reviewerCredentials: row.reviewer_credentials ?? null,
    reviewerPhotoUrl: row.reviewer_photo_url ?? null,
    reviewerContributorId: row.reviewer_contributor_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPage(row: PageRow): StaticPage {
  return { id: row.id, title: row.title, content: row.content, updatedAt: row.updated_at };
}

// ---- Blog (admin/moderator only to write; public reads published only) ----
// Pinned posts always sort first, then newest first within each group.

export async function listPublishedPosts(limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' ORDER BY is_pinned DESC, updated_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(limit) : db.prepare(query);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

/** Legacy: filters by the old free-text `category` column. Kept only so
 * posts created before the category/subcategory restructure keep working. */
export async function getPostsByCategory(category: string, limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' AND category = ? ORDER BY is_pinned DESC, updated_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(category, limit) : db.prepare(query).bind(category);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

/** Current: filters by blog_category_id (the fixed top-level category FK). */
export async function getPostsByCategoryId(blogCategoryId: string, limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' AND blog_category_id = ? ORDER BY is_pinned DESC, updated_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(blogCategoryId, limit) : db.prepare(query).bind(blogCategoryId);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

/** Convenience wrapper: resolves a category slug to its id, then filters.
 * Returns an empty list (not an error) if the slug doesn't match any
 * fixed category, so callers can render an empty state. */
export async function getPostsByCategorySlug(categorySlug: string, limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const category = await db
    .prepare('SELECT id FROM blog_categories WHERE slug = ?')
    .bind(categorySlug)
    .first<{ id: string }>();
  if (!category) return [];
  return getPostsByCategoryId(category.id, limit);
}

/** Filters by blog_subcategory_id — used by the category page's
 * subcategory nav so tapping a subcategory chip narrows the same list
 * without a full category switch. */
export async function getPostsBySubcategoryId(blogSubcategoryId: string, limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' AND blog_subcategory_id = ? ORDER BY is_pinned DESC, updated_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(blogSubcategoryId, limit) : db.prepare(query).bind(blogSubcategoryId);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

export async function adminListAllPosts(): Promise<BlogPost[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM blog_posts ORDER BY is_pinned DESC, updated_at DESC')
    .all<BlogRow>();
  return results.map(mapBlog);
}

/**
 * Other published posts in the same blog category as the given post,
 * newest first, excluding the post itself. Powers the "related posts"
 * widget below a blog post.
 */
export async function getRelatedPosts(
  postId: string,
  blogCategoryId: string | null,
  limit = 4
): Promise<BlogPost[]> {
  if (!blogCategoryId) return [];
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT * FROM blog_posts
       WHERE status = 'published' AND blog_category_id = ? AND id != ?
       ORDER BY is_pinned DESC, updated_at DESC
       LIMIT ?`
    )
    .bind(blogCategoryId, postId, limit)
    .all<BlogRow>();
  return results.map(mapBlog);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = getDb();
  const row = await db
    .prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<BlogRow>();
  return row ? mapBlog(row) : null;
}

export async function createPost(
  authorId: string,
  input: {
    title: string;
    slug: string;
    content: string;
    contentFormat?: BlogContentFormat;
    excerpt?: string;
    status: BlogStatus;
    blogCategoryId: string;
    blogSubcategoryId?: string;
    featuredImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    isSponsored?: boolean;
    isPinned?: boolean;
    fullWidth?: boolean;
    sendAsNewsletter?: boolean;
    sendPush?: boolean;
    authorName?: string;
    authorCredentials?: string;
    authorPhotoUrl?: string;
    authorContributorId?: string;
    reviewerName?: string;
    reviewerCredentials?: string;
    reviewerPhotoUrl?: string;
    reviewerContributorId?: string;
  }
): Promise<BlogPost> {
  const db = getDb();
  const id = generateId('post');
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO blog_posts
        (id, author_id, title, slug, content, content_format, excerpt, blog_category_id, blog_subcategory_id, featured_image_url, seo_title, seo_description, status, is_sponsored, is_pinned, full_width, send_as_newsletter, send_push,
         author_name, author_credentials, author_photo_url, author_contributor_id,
         reviewer_name, reviewer_credentials, reviewer_photo_url, reviewer_contributor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      authorId,
      input.title,
      input.slug,
      input.content,
      input.contentFormat ?? 'markdown',
      input.excerpt ?? null,
      input.blogCategoryId,
      input.blogSubcategoryId ?? null,
      input.featuredImageUrl ?? null,
      input.seoTitle ?? null,
      input.seoDescription ?? null,
      input.status,
      input.isSponsored ? 1 : 0,
      input.isPinned ? 1 : 0,
      input.fullWidth ? 1 : 0,
      input.sendAsNewsletter ? 1 : 0,
      input.sendPush ? 1 : 0,
      input.authorName?.trim() || null,
      input.authorCredentials?.trim() || null,
      input.authorPhotoUrl?.trim() || null,
      input.authorContributorId || null,
      input.reviewerName?.trim() || null,
      input.reviewerCredentials?.trim() || null,
      input.reviewerPhotoUrl?.trim() || null,
      input.reviewerContributorId || null,
      createdAt,
      createdAt
    )
    .run();
  return {
    id,
    authorId,
    title: input.title,
    slug: input.slug,
    content: input.content,
    contentFormat: input.contentFormat ?? 'markdown',
    excerpt: input.excerpt ?? null,
    category: null,
    blogCategoryId: input.blogCategoryId,
    blogSubcategoryId: input.blogSubcategoryId ?? null,
    featuredImageUrl: input.featuredImageUrl ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    status: input.status,
    isSponsored: input.isSponsored ?? false,
    isPinned: input.isPinned ?? false,
    fullWidth: input.fullWidth ?? false,
    sendAsNewsletter: input.sendAsNewsletter ?? false,
    newsletterSentAt: null,
    sendPush: input.sendPush ?? false,
    pushSentAt: null,
    authorName: input.authorName?.trim() || null,
    authorCredentials: input.authorCredentials?.trim() || null,
    authorPhotoUrl: input.authorPhotoUrl?.trim() || null,
    authorContributorId: input.authorContributorId || null,
    reviewerName: input.reviewerName?.trim() || null,
    reviewerCredentials: input.reviewerCredentials?.trim() || null,
    reviewerPhotoUrl: input.reviewerPhotoUrl?.trim() || null,
    reviewerContributorId: input.reviewerContributorId || null,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function updatePost(
  id: string,
  input: Partial<{
    title: string;
    slug: string;
    content: string;
    contentFormat: BlogContentFormat;
    excerpt: string;
    status: BlogStatus;
    blogCategoryId: string;
    blogSubcategoryId: string | null;
    featuredImageUrl: string;
    seoTitle: string;
    seoDescription: string;
    isSponsored: boolean;
    isPinned: boolean;
    fullWidth: boolean;
    sendAsNewsletter: boolean;
    sendPush: boolean;
    authorName: string | null;
    authorCredentials: string | null;
    authorPhotoUrl: string | null;
    authorContributorId: string | null;
    reviewerName: string | null;
    reviewerCredentials: string | null;
    reviewerPhotoUrl: string | null;
    reviewerContributorId: string | null;
  }>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
  if (input.slug !== undefined) { fields.push('slug = ?'); values.push(input.slug); }
  if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
  if (input.contentFormat !== undefined) { fields.push('content_format = ?'); values.push(input.contentFormat); }
  if (input.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(input.excerpt); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (input.blogCategoryId !== undefined) { fields.push('blog_category_id = ?'); values.push(input.blogCategoryId); }
  if (input.blogSubcategoryId !== undefined) { fields.push('blog_subcategory_id = ?'); values.push(input.blogSubcategoryId); }
  if (input.featuredImageUrl !== undefined) { fields.push('featured_image_url = ?'); values.push(input.featuredImageUrl); }
  if (input.seoTitle !== undefined) { fields.push('seo_title = ?'); values.push(input.seoTitle); }
  if (input.seoDescription !== undefined) { fields.push('seo_description = ?'); values.push(input.seoDescription); }
  if (input.isSponsored !== undefined) { fields.push('is_sponsored = ?'); values.push(input.isSponsored ? 1 : 0); }
  if (input.isPinned !== undefined) { fields.push('is_pinned = ?'); values.push(input.isPinned ? 1 : 0); }
  if (input.fullWidth !== undefined) { fields.push('full_width = ?'); values.push(input.fullWidth ? 1 : 0); }
  if (input.sendAsNewsletter !== undefined) { fields.push('send_as_newsletter = ?'); values.push(input.sendAsNewsletter ? 1 : 0); }
  if (input.sendPush !== undefined) { fields.push('send_push = ?'); values.push(input.sendPush ? 1 : 0); }
  const nullable = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  if (input.authorName !== undefined) { fields.push('author_name = ?'); values.push(nullable(input.authorName)); }
  if (input.authorCredentials !== undefined) { fields.push('author_credentials = ?'); values.push(nullable(input.authorCredentials)); }
  if (input.authorPhotoUrl !== undefined) { fields.push('author_photo_url = ?'); values.push(nullable(input.authorPhotoUrl)); }
  if (input.authorContributorId !== undefined) { fields.push('author_contributor_id = ?'); values.push(input.authorContributorId || null); }
  if (input.reviewerName !== undefined) { fields.push('reviewer_name = ?'); values.push(nullable(input.reviewerName)); }
  if (input.reviewerCredentials !== undefined) { fields.push('reviewer_credentials = ?'); values.push(nullable(input.reviewerCredentials)); }
  if (input.reviewerPhotoUrl !== undefined) { fields.push('reviewer_photo_url = ?'); values.push(nullable(input.reviewerPhotoUrl)); }
  if (input.reviewerContributorId !== undefined) { fields.push('reviewer_contributor_id = ?'); values.push(input.reviewerContributorId || null); }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(nowIso());
  values.push(id);
  await db.prepare(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function markNewsletterSent(postId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE blog_posts SET newsletter_sent_at = ? WHERE id = ?')
    .bind(nowIso(), postId)
    .run();
}

export async function markPushSent(postId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE blog_posts SET push_sent_at = ? WHERE id = ?')
    .bind(nowIso(), postId)
    .run();
}

export async function deletePost(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogRow>();
  return row ? mapBlog(row) : null;
}

// ---- Static pages (About, Contact, Terms, Privacy, FAQ, Disclaimer) ----

export async function getStaticPage(id: string): Promise<StaticPage | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM static_pages WHERE id = ?').bind(id).first<PageRow>();
  return row ? mapPage(row) : null;
}

export async function listStaticPages(): Promise<StaticPage[]> {
  const db = getDb();
  const { results } = await db.prepare('SELECT * FROM static_pages').all<PageRow>();
  return results.map(mapPage);
}

/** Admin edits page content directly - upserts since pages are seeded by id. */
export async function upsertStaticPage(id: string, title: string, content: string): Promise<void> {
  const db = getDb();
  const updatedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO static_pages (id, title, content, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`
    )
    .bind(id, title, content, updatedAt)
    .run();
}

/** Published posts credited to a contributor as author or reviewer (author page). */
export async function listPublishedPostsByContributor(contributorId: string, limit = 50): Promise<BlogPost[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT * FROM blog_posts
       WHERE status = 'published' AND (author_contributor_id = ? OR reviewer_contributor_id = ?)
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(contributorId, contributorId, limit)
    .all<BlogRow>();
  return results.map(mapBlog);
}
