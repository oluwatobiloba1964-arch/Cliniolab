// FILE: src/lib/storage/imageUrl.ts
/**
 * Resolves a stored image path (always shaped /api/images/<key>, see
 * r2Client.ts) to the URL the browser should actually load.
 *
 * Images used to be streamed through /api/images/[...key], which meant
 * every single image load on the site cost one serverless function
 * invocation + CPU time. On Vercel's Fluid Active CPU pricing this is the
 * single biggest cost driver for a content-heavy site like this one.
 *
 * Now the DB/content still stores the short /api/images/<key> form (so
 * nothing about uploads, the orphan sweep, or mediaReferenceService needs
 * to change), but anywhere we actually render an <img>/<Image> src or
 * inline HTML, we resolve it to R2's public URL first, so the request
 * goes straight to R2/CDN and never touches a function.
 *
 * R2_PUBLIC_URL should be the bucket's public base URL (an r2.dev
 * subdomain or a custom domain fronting the bucket), with no trailing
 * slash, e.g. https://images.cliniolab.com or
 * https://pub-xxxx.r2.dev
 */
const RAW_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL;
const R2_PUBLIC_BASE = RAW_BASE?.replace(/\/+$/, '');

const IMAGE_PATH_PREFIX = '/api/images/';

/**
 * Converts a single /api/images/<key> path to its R2 public URL. Anything
 * that isn't a recognized /api/images/ path (already-absolute URLs,
 * external images, etc.) is returned unchanged.
 */
export function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (!path.startsWith(IMAGE_PATH_PREFIX)) return path;
  if (!R2_PUBLIC_BASE) return path; // no public URL configured - fall back to the proxy route
  const key = path.slice(IMAGE_PATH_PREFIX.length);
  return `${R2_PUBLIC_BASE}/${key}`;
}

const IMAGE_SRC_PATTERN = /(["'(])(\/api\/images\/(?:blog|resources|banners|scholars|avatars)\/[A-Za-z0-9._-]+)/g;

/**
 * Rewrites every /api/images/... reference found inside a blob of HTML or
 * markdown (blog post bodies, resource descriptions, etc.) to the R2
 * public URL, without touching the stored content itself - this runs only
 * at render time.
 */
export function resolveImageUrlsInHtml(html: string | null | undefined): string {
  if (!html) return '';
  if (!R2_PUBLIC_BASE) return html;
  return html.replace(IMAGE_SRC_PATTERN, (_match, quote: string, path: string) => {
    return `${quote}${resolveImageUrl(path)}`;
  });
}
