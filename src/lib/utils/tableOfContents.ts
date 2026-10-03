// src/lib/utils/tableOfContents.ts
//
// Scans already-rendered post HTML (markdown converted to HTML, or a
// sanitized HTML fragment — never a full raw document, see note in
// BlogPostClient) for <h2>/<h3> headings, assigns each a stable, unique
// id (reusing one the author already set, if any), and returns the
// heading list alongside the html with those ids injected — so the
// table of contents and the in-page anchors always agree.

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Minimum number of headings before a table of contents is worth
 * showing — a post with one or two sections doesn't need a nav for them.
 */
export const MIN_HEADINGS_FOR_TOC = 3;

export function extractTableOfContents(html: string): { html: string; items: TocItem[] } {
  const items: TocItem[] = [];
  const usedIds = new Set<string>();

  const withIds = html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/h[23]>/gi,
    (match, tag: string, attrs: string, inner: string) => {
      const level = Number(tag.slice(1)) as 2 | 3;
      const text = stripTags(inner);
      if (!text) return match; // skip empty headings (shouldn't normally happen)

      const existingIdMatch = attrs.match(/\sid=["']([^"']+)["']/i);
      let id = existingIdMatch ? existingIdMatch[1] : slugify(text) || `section-${items.length + 1}`;

      // De-duplicate: two headings with the same text ("Overview" twice)
      // would otherwise collide and break anchor navigation.
      let unique = id;
      let n = 2;
      while (usedIds.has(unique)) {
        unique = `${id}-${n}`;
        n += 1;
      }
      id = unique;
      usedIds.add(id);

      items.push({ id, text, level });

      const attrsWithoutId = attrs.replace(/\sid=["'][^"']+["']/i, '');
      return `<${tag}${attrsWithoutId} id="${id}">${inner}</${tag}>`;
    }
  );

  return { html: withIds, items };
}
