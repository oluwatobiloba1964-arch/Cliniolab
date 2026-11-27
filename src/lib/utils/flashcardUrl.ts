// src/lib/utils/flashcardUrl.ts
//
// Same pattern as lib/utils/quizUrl.ts, applied to flashcard sets:
// "/flashcards/<title-slug>--<id>", slug derived live from the set's
// current title (no DB column, no migration, nothing to backfill), id
// after the LAST "--" is the only thing ever used to look the set up, and
// a bare "/flashcards/<id>" link (anything not yet updated) keeps
// resolving forever via the same fallback. See quizUrl.ts for the full
// rationale — it applies here unchanged.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

/** Builds the canonical, keyword-rich URL path for a flashcard set (no domain). */
export function flashcardSetPath(set: { id: string; title?: string | null }): string {
  const slug = set.title ? slugify(set.title) : '';
  return slug ? `/flashcards/${slug}--${set.id}` : `/flashcards/${set.id}`;
}

/**
 * Recovers the real set id from a "/flashcards/[setId]" route param — a
 * bare id or a "<slug>--<id>" combo. Splits on the LAST "--" so a title
 * containing a literal "--" can't shift the id boundary.
 */
export function extractFlashcardSetId(param: string): string {
  const idx = param.lastIndexOf('--');
  return idx === -1 ? param : param.slice(idx + 2);
}
