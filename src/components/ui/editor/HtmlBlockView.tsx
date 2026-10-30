'use client';

import { useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';

/**
 * Node view for the htmlBlock node: an editable raw-HTML textarea with a
 * live sanitized preview, mirroring the old RichTextEditor's "HTML mode"
 * UX but scoped to a single block instead of the whole document. The
 * textarea always shows/writes the *sanitized* version, so the preview
 * can never diverge from what a visitor will eventually see, and nothing
 * unsanitized is ever committed to node.attrs.html.
 */
export function HtmlBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(node.attrs.html ?? '');

  function commit() {
    const clean = sanitizeHtml(draft);
    updateAttributes({ html: clean });
    setDraft(clean);
    setEditing(false);
  }

  return (
    <NodeViewWrapper
      className={`my-3 rounded-md border ${selected ? 'border-pulse-400 ring-1 ring-pulse-300' : 'border-flag-300'} bg-flag-50/40`}
      data-html-block="true"
      contentEditable={false}
    >
      <div className="flex items-center justify-between border-b border-flag-200 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-flag-700">
          HTML block
        </span>
        <div className="flex gap-2">
          {editing ? (
            <button
              type="button"
              onClick={commit}
              className="rounded bg-pulse-600 px-2 py-1 text-xs font-medium text-white hover:bg-pulse-700"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(node.attrs.html ?? '');
                setEditing(true);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              Edit HTML
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          autoFocus
          placeholder="<div>Paste or write raw HTML. Sanitized on save. Scripts and event handlers are stripped. <style> blocks are supported and auto-scoped to this post.</div>"
          className="w-full resize-y border-0 bg-white p-3 font-mono text-xs text-ink-700 focus:outline-none"
        />
      ) : (
        <div
          className="prose prose-sm max-w-none p-3"
          dangerouslySetInnerHTML={{ __html: node.attrs.html || '<p class="text-ink-300">Empty. Click Edit HTML</p>' }}
        />
      )}
    </NodeViewWrapper>
  );
}
