// src/app/blog/[slug]/BlogPostClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { markdownToHtml } from '@/components/ui/RichTextEditor';
import { sanitizeHtml, wrapWithScopeClass } from '@/lib/utils/sanitizeHtml';
import { RawHtmlFrame, isFullRawDocument } from '@/components/ui/RawHtmlFrame';
import { ShareButton } from '@/components/quiz/ShareButton';
import { RelatedQuizzes } from '@/components/quiz/RelatedQuizzes';
import { AuthorBox } from '@/components/blog/AuthorBox';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { RelatedPosts } from '@/components/cms/RelatedPosts';
import { CommentThread } from '@/components/quiz/CommentThread';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { extractTableOfContents, MIN_HEADINGS_FOR_TOC } from '@/lib/utils/tableOfContents';
import { useBlogSubcategoryName } from '@/lib/hooks/useBlogSubcategoryName';
import { useBlogCategorySlug } from '@/lib/hooks/useBlogCategorySlug';
import type { BlogPost } from '@/types';

const FALLBACK_COVERS: Record<'job' | 'scholarship' | 'default', string> = {
  job: '/job-fallback.svg',
  scholarship: '/scholarship-fallback.svg',
  default: '/blog-fallback.svg',
};

function resolveCoverImage(post: BlogPost, categorySlug: string | null): string {
  if (post.featuredImageUrl) return post.featuredImageUrl;
  if (categorySlug === 'job') return FALLBACK_COVERS.job;
  if (categorySlug === 'scholarship') return FALLBACK_COVERS.scholarship;
  return FALLBACK_COVERS.default;
}

function looksLikeHtml(content: string): boolean {
  const sample = content.slice(0, 1000);

  // Full document wrapper (doctype/html/head/body).
  if (/<!DOCTYPE\s+html/i.test(sample)) return true;
  if (/<html[\s>]/i.test(sample)) return true;
  if (/<head[\s>]/i.test(sample)) return true;
  if (/<body[\s>]/i.test(sample)) return true;

  // A <style> block is a strong signal someone pasted real HTML/CSS
  // rather than writing markdown.
  if (/<style[\s>]/i.test(sample)) return true;

  // Otherwise, count real HTML tags (open or self-closing) from a
  // reasonably broad set of common block/inline elements. Markdown
  // occasionally contains a stray inline tag, so require a few distinct
  // matches before treating the whole post as HTML rather than markdown.
  const tagMatches = sample.match(
    /<\/?(div|span|p|section|article|header|footer|nav|main|table|tr|td|th|ul|ol|li|h[1-6]|img|a|button|form|label|input|strong|em|br|hr)[\s/>]/gi
  );
  return (tagMatches?.length ?? 0) >= 3;
}

/**
 * Some posts were saved before "raw HTML mode" existed, or lost their
 * <!DOCTYPE>/<html> wrapper somewhere along the way (e.g. sanitizeHtml
 * strips those since they're not fragment-safe tags), even though the
 * author clearly designed the content as a styled page rather than a
 * simple article. isFullRawDocument() alone misses these, and they end
 * up squeezed into the narrow article column with their own <style>
 * rules fighting the surrounding max-w-2xl box.
 *
 * Heuristic: a fragment carrying its own <style> block (own layout/CSS
 * intent), or with a fixed pixel width baked into inline styles, reads
 * the same way a full document does — it wants control of its own
 * width, not to sit inside the article column. Anything that matches
 * gets the wide container even though it renders via the fragment path
 * (sanitizeHtml + scoping), not the iframe.
 */
function looksLikeWideDesignedContent(content: string): boolean {
  if (/<style[\s>]/i.test(content)) return true;
  if (/width\s*:\s*\d{3,}px/i.test(content)) return true;
  return false;
}

const FLATTEN_BOXED_CONTENT_CSS = `
  .post-content-flatten, .post-content-flatten * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  /* Collapses a fixed-width/self-margined body wrapper (e.g. an author's
     own <body style="max-width:880px; margin:0 auto">, common in HTML
     pasted from another site) so the fragment can use the full width of
     its now-wide container, instead of imposing its own narrower one
     inside it. */
  .post-content-flatten > *:first-child {
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .post-content-flatten > div,
  .post-content-flatten > section,
  .post-content-flatten > article {
    width: 100% !important;
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    border: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .post-content-flatten img,
  .post-content-flatten video,
  .post-content-flatten iframe,
  .post-content-flatten svg {
    max-width: 100% !important;
    height: auto !important;
  }
  .post-content-flatten table {
    display: block !important;
    max-width: 100% !important;
    overflow-x: auto !important;
  }
  .post-content-flatten pre {
    max-width: 100% !important;
    overflow-x: auto !important;
  }
`;

export function BlogPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setLoadError(false);
    setPost(null);

    fetch(`/api/blog/${slug}`)
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.post) {
          setPost(data.post);
        } else if (data) {
          // Response was ok but the payload didn't include a post — treat
          // as not-found rather than silently showing a blank page.
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Post not found</h1>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Couldn&apos;t load this post</h1>
        <p className="mt-2 text-sm text-ink-500">Check your connection and try refreshing the page.</p>
      </div>
    );
  }

  if (!post) {
    // Loading state — avoids a blank flash while the fetch is in flight.
    return (
      <div className="mx-auto max-w-2xl animate-pulse px-6 py-16">
        <div className="mb-6 h-64 w-full rounded-lg bg-ink-100" />
        <div className="h-6 w-3/4 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-1/3 rounded bg-ink-100" />
      </div>
    );
  }

  return <BlogPostBody post={post} />;
}

function BlogPostBody({ post }: { post: BlogPost }) {
  const { authorBox } = usePublicConfig();
  const subcategoryName = useBlogSubcategoryName(post.blogCategoryId, post.blogSubcategoryId);
  const categorySlug = useBlogCategorySlug(post.blogCategoryId);
  const isRaw = isFullRawDocument(post.content);
  // Covers old/edge-case posts that carry their own <style> or fixed
  // pixel widths but, for whatever historical reason, don't trip the
  // "full raw document" check — these still need a wide container
  // instead of the narrow article column.
  // Any post explicitly authored in raw-HTML mode (contentFormat === 'html')
  // is treated as designed content and gets the wide container by default —
  // not just ones that happen to carry a <style> block or a hardcoded pixel
  // width. Someone who reaches for "HTML mode" instead of the normal Tiptap
  // editor is doing so because they want layout control the narrow article
  // column doesn't give them (custom tables, multi-column callouts, embeds,
  // etc.), so a plain HTML fragment with no special markers should still
  // read as "wide" rather than falling back to the narrow max-w-2xl column
  // and looking boxed-in next to its own styling assumptions.
  const isWideFragment =
    !isRaw && (post.contentFormat === 'html' || looksLikeWideDesignedContent(post.content));
  const wide = isRaw || isWideFragment || post.fullWidth;

  return (
    <div className="py-16">
      {/* Header block (title, meta, category) always stays at readable
          width — only the post body itself is allowed to go full width,
          since that's the part authors sometimes paste as a complete,
          wide HTML document. */}
      <div className="mx-auto max-w-2xl px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveCoverImage(post, categorySlug)}
          alt=""
          className="mb-6 h-64 w-full rounded-lg object-cover"
        />
        <div className="flex flex-wrap items-center gap-2">
          {post.isPinned && (
            <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-medium text-flag-600">Pinned</span>
          )}
          {post.isSponsored && (
            <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">Sponsored</span>
          )}
          {post.category && <span className="text-xs font-medium text-ink-400">{post.category}</span>}
          {subcategoryName && (
            <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
              {subcategoryName}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-3xl font-semibold text-ink-800">{post.title}</h1>
          {typeof window !== 'undefined' && (
            <ShareButton url={window.location.href} title={post.title} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
          {post.authorName && (
            <span>
              By{' '}
              <span className="font-medium text-ink-600">
                {post.authorName}
                {post.authorCredentials && <span className="font-normal">, {post.authorCredentials}</span>}
              </span>
            </span>
          )}
          {post.authorName && <span aria-hidden="true">&middot;</span>}
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Post body: full raw HTML documents render edge-to-edge (up to a
          generous max width) via the shared sandboxed iframe, so a pasted
          HTML page is never squeezed into the same narrow column as the
          title/byline text. Fragments that carry their own <style>/fixed
          widths (including older posts saved before raw-HTML mode
          existed) get the same wide container even though they still
          render through the fragment/sanitize path below — only the
          iframe rendering itself is reserved for true full documents.
          Plain markdown/article posts stay at readable article width. */}
      {isRaw ? (
        <div className="mx-auto mt-6 max-w-6xl px-6">
          <RawHtmlFrame html={post.content} />
        </div>
      ) : (
        (() => {
          const renderedHtml =
            post.contentFormat === 'html' || looksLikeHtml(post.content)
              ? wrapWithScopeClass(sanitizeHtml(post.content, post.id), post.id)
              : markdownToHtml(post.content);
          // The table of contents is auto-generated from whatever <h2>/<h3>
          // headings the post already has — nothing for the author to turn
          // on. It's skipped below MIN_HEADINGS_FOR_TOC since a nav for one
          // or two sections isn't worth the space.
          const { html: htmlWithIds, items: tocItems } = extractTableOfContents(renderedHtml);
          const showToc = tocItems.length >= MIN_HEADINGS_FOR_TOC;

          return (
            <div className={`mx-auto px-6 ${wide ? 'max-w-6xl' : showToc ? 'max-w-4xl' : 'max-w-2xl'}`}>
              <style>{FLATTEN_BOXED_CONTENT_CSS}</style>
              <div className={showToc ? 'mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]' : undefined}>
                {showToc && <TableOfContents items={tocItems} />}
                <div
                  className={`post-content-flatten prose prose-sm max-w-none text-ink-700 ${
                    showToc ? '' : 'mt-6'
                  }`}
                  dangerouslySetInnerHTML={{ __html: htmlWithIds }}
                />
              </div>
            </div>
          );
        })()
      )}

      <div className="mx-auto max-w-2xl px-6">
        <AuthorBox
          authorName={post.authorName}
          authorCredentials={post.authorCredentials}
          authorPhotoUrl={post.authorPhotoUrl}
          authorBio={post.authorBio}
          reviewerName={post.reviewerName}
          reviewerCredentials={post.reviewerCredentials}
          reviewerPhotoUrl={post.reviewerPhotoUrl}
          reviewerBio={post.reviewerBio}
          setting={authorBox}
        />
        <CommentThread
          endpoint={`/api/blog/${post.id}/comments`}
          placeholder="Share your thoughts on this post…"
        />
        <RelatedPosts endpoint={`/api/blog/${post.slug}/related-posts`} title="Related posts" />
        <RelatedQuizzes endpoint={`/api/blog/${post.slug}/related`} title="Practice quizzes for this topic" />
      </div>
    </div>
  );
}
