// src/components/ui/MarkdownCheatsheet.tsx
'use client';

/**
 * Feature #19 - Floating markdown cheat sheet overlay for the Tiptap
 * / RichTextEditor.
 *
 * Reduces support load: admin authors see the supported syntax in a
 * single click rather than digging through the toolbar. Pure client-
 * side modal; no DB, no API.
 */
import { useState } from 'react';

interface MarkdownCheatsheetProps {
  /** Optional trigger label override. */
  triggerLabel?: string;
}

interface CheatRow {
  syntax: string;
  result: string;
}

const ROWS: CheatRow[] = [
  { syntax: '**bold**', result: 'bold text' },
  { syntax: '_italic_', result: 'italic text' },
  { syntax: '## Heading', result: 'H2 heading' },
  { syntax: '### Sub-heading', result: 'H3 sub-heading' },
  { syntax: '> quote', result: 'Blockquote' },
  { syntax: '- item', result: 'Bullet list item' },
  { syntax: '1. item', result: 'Numbered list item' },
  { syntax: '[text](url)', result: 'Hyperlink' },
  { syntax: '![](url)', result: 'Image' },
  { syntax: '---', result: 'Horizontal divider' },
  { syntax: '`code`', result: 'Inline code' },
  { syntax: '```\ncode block\n```', result: 'Code block' },
];

export function MarkdownCheatsheet({ triggerLabel = 'Syntax help' }: MarkdownCheatsheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-700"
        aria-label="Open markdown syntax cheat sheet"
      >
        ?&nbsp;{triggerLabel}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Markdown syntax cheat sheet"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink-900">Markdown cheat sheet</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              The toolbar above also inserts these patterns automatically. This is a quick reference for typing them by hand.
            </p>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-2 pr-4 font-semibold">You type</th>
                  <th className="py-2 font-semibold">You see</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.syntax} className="border-b border-ink-50">
                    <td className="py-2 pr-4">
                      <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-xs text-ink-700">
                        {row.syntax}
                      </code>
                    </td>
                    <td className="py-2 text-ink-700">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-ink-400">
              Tip: Most keyboard shortcuts (Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic) also work in this editor.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-pulse-600 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-700"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
