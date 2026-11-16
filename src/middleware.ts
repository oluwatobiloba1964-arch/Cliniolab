import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase auth session cookie on every request. Required by
 * @supabase/ssr so server components see a valid, non-expired session
 * without each page having to handle refresh logic itself.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // NEXT_PUBLIC_* vars set via the Cloudflare dashboard land in
  // getCloudflareContext().env at runtime, not in process.env the way
  // Node-hosted platforms (Vercel) expose them — so check both, preferring
  // whichever is actually populated.
  //
  // getCloudflareContext() is only safe to call when actually running on
  // Cloudflare Workers/Pages. On Vercel there's no Workers runtime backing
  // it, and calling it there can hang instead of throwing synchronously —
  // since this is a fatal, blocking error, it stalls this middleware on
  // every request until Vercel kills it with a 504
  // (MIDDLEWARE_INVOCATION_TIMEOUT).
  //
  // NOTE: don't gate this on the `caches` global — Vercel's Edge runtime
  // also exposes `caches` (it's a standard Web API, not Cloudflare-specific),
  // so that check doesn't distinguish the two platforms. Vercel reliably
  // sets process.env.VERCEL at build and runtime, so use that as the
  // exclusion signal instead: only attempt the Cloudflare-only call when
  // we are NOT on Vercel.
  let cfEnv: Record<string, unknown> = {};
  if (!process.env.VERCEL) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      cfEnv = getCloudflareContext().env as Record<string, unknown>;
    } catch {
      // Defensive fallback — process.env alone is authoritative here.
    }
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? (cfEnv.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    (cfEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Narrowed again: purely public surfaces — homepage, quizzes, flashcards
  // and categories — no longer run this middleware at all. Those are the
  // highest-traffic pages and they don't branch on auth server-side
  // (auth-aware UI there is client-side via useAuth(), which refreshes its
  // own session). Every public page view previously paid an extra
  // cross-continental Supabase round trip here before rendering; that hop
  // is now gone. Dashboard/admin/creator/guest/leaderboard/login/register
  // still refresh the session cookie as before.
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/leaderboard',
    '/login',
    '/register',
    '/creator/:path*',
    '/guest/:path*',
  ],
};
