'use client';

/**
 * Client-only keyboard shortcuts help overlay.
 * No network or database access. Press ? to open from runners that wire it in.
 */

export type ShortcutRow = {
  keys: string;
  action: string;
};

interface ShortcutsHelpPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  rows: ShortcutRow[];
}

export function ShortcutsHelpPanel({
  open,
  onClose,
  title = 'Keyboard shortcuts',
  rows,
}: ShortcutsHelpPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-200 dark:bg-[#101C27]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-800">{title}</h3>
            <p className="mt-1 text-xs text-ink-500">Local only. Does not change scores or server data.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-semibold text-ink-500 hover:bg-ink-50 hover:text-ink-800"
            aria-label="Close shortcuts help"
          >
            Esc
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={`${row.keys}-${row.action}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-sm"
            >
              <span className="text-ink-600">{row.action}</span>
              <kbd className="shrink-0 rounded-md border border-ink-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-ink-700 shadow-sm">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[11px] text-ink-400">Press ? again or Esc to close</p>
      </div>
    </div>
  );
}

export const QUIZ_SHORTCUTS: ShortcutRow[] = [
  { keys: '1-4', action: 'Select option A-D' },
  { keys: '←', action: 'Previous question' },
  { keys: '→ or Enter', action: 'Next question' },
  { keys: 'M', action: 'Mark for review' },
  { keys: '?', action: 'Show this help' },
];

export const STUDY_SHORTCUTS: ShortcutRow[] = [
  { keys: '←', action: 'Previous question' },
  { keys: '→', action: 'Next (after reveal)' },
  { keys: '?', action: 'Show this help' },
];

export const FLASHCARD_SHORTCUTS: ShortcutRow[] = [
  { keys: 'Space / Enter', action: 'Flip card' },
  { keys: '←', action: 'Previous card' },
  { keys: '→', action: 'Next card' },
  { keys: '?', action: 'Show this help' },
];
