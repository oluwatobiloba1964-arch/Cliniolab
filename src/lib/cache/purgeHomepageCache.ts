// src/lib/cache/purgeHomepageCache.ts

/**
 * Deletes the edge-cached /api/homepage-data response so the next request
 * rebuilds it fresh from D1. Call this after any write that changes what
 * the homepage shows (blog posts, quizzes, flashcards, etc).
 *
 * Safe to call from any runtime: if `caches.default` isn't available
 * (e.g. local dev, non-Cloudflare environment), this is a no-op.
 *
 * Fire-and-forget by design — callers should not await this on the
 * critical path of a save/publish response.
 */
export async function purgeHomepageCache(origin?: string): Promise<void> {
  try {
    const cacheStorage = (globalThis as typeof globalThis & {
      caches?: { default?: Cache };
    }).caches;
    const edgeCache = cacheStorage?.default;
    if (!edgeCache) return;

    const base = origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://cliniolab.vercel.app';
    const cacheKey = new Request(new URL('/api/homepage-data', base).toString(), { method: 'GET' });
    await edgeCache.delete(cacheKey);
  } catch {
    // Never let a cache purge failure break the actual save/publish.
  }
}
