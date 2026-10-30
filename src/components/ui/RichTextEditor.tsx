'use client';

import { useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
// Feature #19: Floating markdown cheat sheet for blog editor authors.
import { MarkdownCheatsheet } from '@/components/ui/MarkdownCheatsheet';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  /** 'markdown' (default) uses the toolbar + Markdown syntax. 'html' lets admin/moderator paste or write raw HTML directly — sanitized before ever being rendered. */
  format?: 'markdown' | 'html';
  onFormatChange?: (format: 'markdown' | 'html') => void;
}

/**
 * A dependency-free editor supporting two modes:
 * - Markdown (default): toolbar buttons insert Markdown syntax, safe by
 *   construction since markdownToHtml never passes through arbitrary tags.
 * - HTML: for admin/moderator posts that need embeds, custom tables, or
 *   other structures Markdown can't express — e.g. pasting a code sample
 *   as an actual formatted snippet. Raw HTML is sanitized (see
 *   sanitizeHtml.ts) both in the live preview here and again at render
 *   time on the public post page, so what's shown while editing always
 *   matches what a visitor will actually see.
 */
export function RichTextEditor({ value, onChange, rows = 12, format = 'markdown', onFormatChange }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  function wrapSelection(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const newValue =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = selectionStart + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function insertLinePrefix(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart } = textarea;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newValue);
  }

  function insertBlock(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart } = textarea;
    const needsLeadingNewline = selectionStart > 0 && value[selectionStart - 1] !== '\n';
    const insert = (needsLeadingNewline ? '\n' : '') + text + '\n';
    const newValue = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
    onChange(newValue);
  }

  function insertLink() {
    const url = window.prompt('Link URL:');
    if (!url) return;
    wrapSelection('[', `](${url})`);
  }

  function insertImage() {
    const url = window.prompt('Image URL:');
    if (!url) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart } = textarea;
    const newValue = value.slice(0, selectionStart) + `![](${url})` + value.slice(selectionStart);
    onChange(newValue);
  }

  const toolbarButtons: { label: string; action: () => void; title: string }[] = [
    { label: 'B', title: 'Bold', action: () => wrapSelection('**') },
    { label: 'I', title: 'Italic', action: () => wrapSelection('_') },
    { label: 'H2', title: 'Heading', action: () => insertLinePrefix('## ') },
    { label: 'H3', title: 'Sub-heading', action: () => insertLinePrefix('### ') },
    { label: '"', title: 'Quote', action: () => insertLinePrefix('> ') },
    { label: '•', title: 'Bullet list', action: () => insertLinePrefix('- ') },
    { label: '1.', title: 'Numbered list', action: () => insertLinePrefix('1. ') },
    { label: '🔗', title: 'Link', action: insertLink },
    { label: '🖼', title: 'Image', action: insertImage },
    { label: '―', title: 'Divider', action: () => insertBlock('---') },
  ];

  const previewHtml = format === 'html' ? sanitizeHtml(value) : markdownToHtml(value);

  return (
    <div className="rounded-md border border-ink-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-100 bg-ink-50/50 p-2">
        {onFormatChange && (
          <div className="mr-2 flex items-center gap-1 rounded-md border border-ink-100 p-0.5">
            <button
              type="button"
              onClick={() => onFormatChange('markdown')}
              className={`rounded px-2 py-1 text-xs font-medium ${format === 'markdown' ? 'bg-pulse-100 text-pulse-700' : 'text-ink-500'}`}
            >
              Markdown
            </button>
            <button
              type="button"
              onClick={() => onFormatChange('html')}
              className={`rounded px-2 py-1 text-xs font-medium ${format === 'html' ? 'bg-pulse-100 text-pulse-700' : 'text-ink-500'}`}
            >
              HTML
            </button>
          </div>
        )}
        {format === 'markdown' &&
          toolbarButtons.map((btn) => (
            <button
              key={btn.title}
              type="button"
              title={btn.title}
              onClick={btn.action}
              className="rounded px-2 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-100"
            >
              {btn.label}
            </button>
          ))}
        <div className="ml-auto">
          {/* Feature #19 - Markdown cheat sheet, opens a modal with the
              supported syntax. Pure client-side, no DB / API. */}
          <MarkdownCheatsheet />
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`rounded px-2 py-1 text-xs font-medium ${showPreview ? 'bg-pulse-100 text-pulse-700' : 'text-ink-500'}`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {format === 'html' && !showPreview && (
        <p className="border-b border-ink-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Raw HTML mode: paste code samples, embeds, custom markup, or a{' '}
          <code>&lt;style&gt;</code> block. It&apos;s sanitized before publishing (scripts and
          event handlers are always stripped); any <code>&lt;style&gt;</code> block is kept but
          scoped to this post only. Selectors like <code>html</code>, <code>body</code>, or site
          navigation classes are dropped so author CSS can never restyle the rest of the site.
          Double-check the Preview tab before saving.
        </p>
      )}

      {showPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 text-ink-700"
          style={{ minHeight: rows * 24 }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={
            format === 'html'
              ? 'Write or paste raw HTML, e.g. <pre><code>...</code></pre> for a code sample, or a <style> block for custom CSS (auto-scoped to this post)'
              : 'Write your post using the toolbar above, or plain Markdown...'
          }
          className={`w-full resize-y border-0 p-4 text-sm focus:outline-none ${format === 'html' ? 'font-mono' : ''}`}
        />
      )}
    </div>
  );
}

/**
 * Minimal Markdown-to-HTML converter covering the subset the toolbar
 * produces (headings, bold, italic, links, images, lists, quotes,
 * paragraphs). Not a full CommonMark implementation, but robust for the
 * blog editor's actual output and safe (no arbitrary HTML passthrough).
 */
export function markdownToHtml(markdown: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = escapeHtml(markdown).split('\n');
  const htmlLines: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  function closeList() {
    if (inList) {
      htmlLines.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/!\[\]\((.*?)\)/g, '<img src="$1" alt="" style="max-width:100%;border-radius:6px;margin:8px 0" />')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      closeList();
      htmlLines.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      htmlLines.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.trim() === '---') {
      closeList();
      htmlLines.push('<hr />');
    } else if (line.startsWith('> ')) {
      closeList();
      htmlLines.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
    } else if (line.startsWith('- ')) {
      if (inList !== 'ul') { closeList(); htmlLines.push('<ul>'); inList = 'ul'; }
      htmlLines.push(`<li>${inlineFormat(line.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (inList !== 'ol') { closeList(); htmlLines.push('<ol>'); inList = 'ol'; }
      htmlLines.push(`<li>${inlineFormat(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      htmlLines.push(`<p>${inlineFormat(line)}</p>`);
    }
  }
  closeList();

  return htmlLines.join('\n');
}
