// src/lib/quizUrl.ts
//
// Quiz URLs are built as "/quizzes/<title-slug>--<id>". The id is the real
// primary key (generateId('quiz'), a 20-char random hex string) and is the
// ONLY thing ever used to look the quiz up — the slug in front is purely
// for SEO/CTR (a keyword-rich URL in the search snippet and when a link is
// pasted into WhatsApp/Telegram ranks and gets clicked more than a bare id)
// and for readability when a link is shared. Because the lookup always
// goes by the id suffix:
//   - No DB migration or backfill needed. There is no slug column on the
//     quizzes table at all, and none is added — the slug is derived live
//     from the quiz's current title every time a URL is built, so it can
//     never drift stale if a creator edits the title later, and there's
//     nothing to populate for quizzes that already exist.
//   - Every bare "/quizzes/<id>" link already shared, bookmarked, indexed
//     by Google, or hardcoded elsewhere in this codebase keeps working
//     forever — extractQuizId() falls back to treating the whole segment
//     as the id when there's no "--" separator.
//   - A collision between two quizzes' slugged ids can't happen: the "--"
//     separator plus the full id after it is unique by construction.
//
// Mirrors lib/utils/listing-url.ts in the Zamorax codebase — same pattern,
// applied to quizzes instead of listings.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

/** Builds the canonical, keyword-rich URL path for a quiz (no domain). */
export function quizPath(quiz: { id: string; title?: string | null }): string {
  const slug = quiz.title ? slugify(quiz.title) : '';
  return slug ? `/quizzes/${slug}--${quiz.id}` : `/quizzes/${quiz.id}`;
}

/**
 * Recovers the real quiz id from a "/quizzes/[quizId]" route param, which
 * may be a bare id (old links, anything not yet updated to quizPath()) or
 * a "<slug>--<id>" combo. Always split on the LAST "--" so a title that
 * itself contains a literal "--" can't shift the id boundary.
 */
export function extractQuizId(param: string): string {
  const idx = param.lastIndexOf('--');
  return idx === -1 ? param : param.slice(idx + 2);
}
