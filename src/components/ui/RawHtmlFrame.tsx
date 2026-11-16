'use client';

import { useEffect, useState } from 'react';

/**
 * A post is a "full raw document" when it's a complete standalone HTML
 * page (doctype/html/head) rather than a content fragment meant to sit
 * inside the site's own layout. These render via a sandboxed iframe
 * instead of the text-level sanitizer, so the author's CSS (including
 * @media, *, arbitrary selectors) renders pixel-perfect without the
 * scoping/stripping tradeoffs of sanitizeHtml.
 */
export function isFullRawDocument(content: string): boolean {
  const sample = content.slice(0, 1000);
  return (
    /<!DOCTYPE\s+html/i.test(sample) ||
    /<html[\s>]/i.test(sample) ||
    /<head[\s>]/i.test(sample)
  );
}

/**
 * Many authors paste a full HTML document that was never designed with a
 * mobile viewport in mind (no <meta name="viewport">, or fixed pixel
 * widths). Without a viewport meta tag, phones render the iframe's
 * document at a default desktop-width viewport (~980px) and then scale
 * it down, which is what makes pasted posts look cramped/tiny on mobile.
 * We inject one if the author didn't include their own, so the page
 * lays out at the actual device width instead of a shrunken desktop view.
 */
function ensureViewportMeta(html: string): string {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${viewportTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${viewportTag}</head>`);
  }
  return `${viewportTag}${html}`;
}

/**
 * A viewport meta tag alone stops the browser from *scaling down* a
 * desktop-width page, but it doesn't help if the author's own CSS hardcodes
 * pixel widths (e.g. `body { width: 1080px }`, a wrapper `<div
 * style="width:1000px">`, or a wide fixed-width table). In that case the
 * content renders at true 1:1 size but still doesn't fit the phone — it
 * just looks "boxed in" with dead space on either side, or gets clipped.
 *
 * This stylesheet is appended (not prepended) so it wins the cascade
 * against the author's own <style> block via source order, while staying
 * low-specificity enough not to break intentional layouts:
 * - Caps body/html and common wrapper elements to 100% of the viewport
 *   width instead of a fixed px value.
 * - Lets any element that's still wider than the viewport (e.g. a big
 *   table) scroll horizontally in its own box, rather than blowing out
 *   the whole page width.
 * - Forces all images/media to scale down to fit.
 *
 * IMPORTANT — do not force `width: auto !important` on generic block
 * containers here. An earlier version of this override did that (on
 * body/div/section/article/main/header/footer) to collapse fixed-pixel
 * "boxed card" wrappers back to fluid width. That works for simple
 * documents, but it actively breaks any author layout built with CSS
 * Grid or Flexbox: a grid/flex *item* with `width: auto !important`
 * stops stretching to fill its track/flex-basis and instead shrinks to
 * its content's intrinsic size. A two-column `display:grid;
 * grid-template-columns: 260px minmax(0,860px)` layout, for example,
 * would have its main content column collapse to a narrow, "boxed"
 * width with dead space beside it — the exact symptom this override
 * exists to prevent, just reintroduced by the override itself.
 * `max-width: 100%` alone (below) is sufficient to stop a fixed-pixel
 * wrapper from overflowing the viewport, without fighting the author's
 * own layout system.
 */
const RESPONSIVE_OVERRIDE_CSS = `
<style>
  html, body {
    max-width: 100% !important;
    width: 100% !important;
    overflow-x: hidden !important;
    background: #F7F5F0 !important;
    margin: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 16px !important;
    padding-right: 16px !important;
    box-sizing: border-box !important;
  }

  /* Flatten the common "boxed card" pattern: a wrapper div (or the body
     itself) with its own white/light background, box-shadow, border,
     border-radius, or outer margin. This is what makes pasted HTML read
     as a floating rectangle instead of flowing text. Padding is left
     alone so inner spacing/readability isn't disturbed, and width/
     max-width are deliberately NOT touched here — see the note above
     about Grid/Flexbox layouts. A fixed-pixel wrapper is still capped
     by the max-width:100% on html/body above; it just isn't forced to
     "auto" anymore, which is what let Grid/Flex-based designs collapse. */
  body, body * {
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    border: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  /* Still cap anything that would overflow the viewport width, but as
     a ceiling (max-width) rather than forcing a specific width value —
     this keeps oversized fixed-pixel elements from causing horizontal
     scroll without interfering with Grid/Flexbox track sizing. */
  body * {
    max-width: 100% !important;
  }

  img, video, iframe, canvas, svg { max-width: 100% !important; height: auto !important; }
  table { display: block !important; max-width: 100% !important; overflow-x: auto !important; }
  pre { max-width: 100% !important; overflow-x: auto !important; }
  * { box-sizing: border-box !important; }

  /* Author layouts built with CSS Grid (e.g. a sidebar + main-content
     template) already have their own @media collapse rules for mobile
     in the vast majority of cases (this is standard practice for any
     grid-based document). We don't need to, and must not, override
     grid-template-columns ourselves — doing so would fight the
     author's own responsive design instead of complementing it. */
</style>
`;

/** Injects the responsive override stylesheet right before </head> so it loads after, and wins the cascade against, the author's own styles — flattening any boxed/card look into flush, full-width, page-matching content. */
function injectResponsiveOverrides(html: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${RESPONSIVE_OVERRIDE_CSS}</head>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${RESPONSIVE_OVERRIDE_CSS}</html>`);
  }
  return `${html}${RESPONSIVE_OVERRIDE_CSS}`;
}

interface RawHtmlFrameProps {
  html: string;
  /** Caps the frame's auto-fit height so a huge/broken document can't blow out the surrounding page (e.g. an editor preview panel). Omit for the public post page, where the frame should grow to fit its content. */
  maxHeightPx?: number;
}

/**
 * Renders a full raw HTML document (with its own <style>, @media, *, etc.)
 * inside a sandboxed iframe sized to its own content. `sandbox="allow-scripts"`
 * (no allow-same-origin, no allow-forms, no allow-top-navigation) means the
 * iframe gets its own opaque origin — any script inside it cannot read the
 * parent page's cookies, session, or DOM, and cannot navigate the parent
 * window. This is what lets us skip sanitizeHtml entirely for this path
 * without reopening the XSS/session-theft risk it exists to prevent.
 *
 * Shared by both the public post page and the admin editor's live preview,
 * so a fix to responsiveness/sandboxing here applies in both places at once.
 */
export function RawHtmlFrame({ html, maxHeightPx }: RawHtmlFrameProps) {
  const [height, setHeight] = useState(600);
  const [frameEl, setFrameEl] = useState<HTMLIFrameElement | null>(null);

  const scopedHtml = injectResponsiveOverrides(ensureViewportMeta(html));

  useEffect(() => {
    if (!frameEl) return;

    const resize = () => {
      try {
        const doc = frameEl.contentDocument;
        if (doc?.documentElement) {
          setHeight(doc.documentElement.scrollHeight + 24);
        }
      } catch {
        // Cross-origin (opaque sandbox origin) — can't read scrollHeight.
        // Falls back to the last known/default height.
      }
    };

    frameEl.addEventListener('load', resize);
    // Adaptive sizing: poll at 500ms while the document is still settling
    // (images/fonts loading can change height), and stop entirely once the
    // height has been stable for 3 consecutive checks. Previously this ran
    // every 500ms forever for the lifetime of the frame — pure idle CPU on
    // every blog post page. A `load` event re-fires on full reloads, and
    // the cleanup clears everything on unmount.
    let stableChecks = 0;
    let lastHeight = -1;
    const interval = setInterval(() => {
      resize();
      if (height === lastHeight) {
        stableChecks += 1;
        if (stableChecks >= 3) clearInterval(interval);
      } else {
        stableChecks = 0;
        lastHeight = height;
      }
    }, 500);

    return () => {
      frameEl.removeEventListener('load', resize);
      clearInterval(interval);
    };
  }, [frameEl]);

  const resolvedHeight = maxHeightPx ? Math.min(height, maxHeightPx) : height;

  return (
    <iframe
      ref={setFrameEl}
      srcDoc={scopedHtml}
      sandbox="allow-scripts allow-popups"
      style={{
        width: '100%',
        height: resolvedHeight,
        border: 'none',
        display: 'block',
        overflow: maxHeightPx ? 'auto' : undefined,
      }}
      title="HTML preview"
    />
  );
}
