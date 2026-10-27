// src/components/quiz/BulkQuestionSelect.tsx
'use client';

/**
 * Feature #20 - Bulk-select in admin quiz question manager.
 *
 * Wraps a list of questions with shift-click multi-select. The parent
 * passes an array of question ids and a render function; this component
 * tracks the selection set and exposes "select all / none / invert",
 * plus "delete selected" and "reorder selected" actions.
 *
 * Pure client-side state management on top of existing endpoints; the
 * parent component decides what to do with the selected ids.
 */
import { useState, useCallback, type MouseEvent, type ReactNode } from 'react';

interface BulkQuestionSelectProps {
  /** All question ids in the current view. */
  allIds: string[];
  /** Render the question row; receives the id, the isSelected flag,
   *  and a click handler the row should attach. */
  renderRow: (id: string, isSelected: boolean, onRowClick: (e: MouseEvent) => void) => ReactNode;
  /** Called when the user triggers the bulk action with the current
   *  selection. */
  onBulkAction?: (action: 'delete' | 'reorder' | 'export', selectedIds: string[]) => void;
  /** Show the export option. Default true. */
  allowExport?: boolean;
  /** Show the reorder option. Default true. */
  allowReorder?: boolean;
}

export function BulkQuestionSelect({
  allIds,
  renderRow,
  onBulkAction,
  allowExport = true,
  allowReorder = true,
}: BulkQuestionSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const handleRowClick = useCallback(
    (id: string) => (e: MouseEvent) => {
      // Plain click toggles a single id.
      // Shift-click selects a range from the last clicked id to this one.
      setSelected((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastClicked) {
          const start = allIds.indexOf(lastClicked);
          const end = allIds.indexOf(id);
          if (start !== -1 && end !== -1) {
            const from = Math.min(start, end);
            const to = Math.max(start, end);
            // Range select replaces (rather than unions) so the action is predictable.
            next.clear();
            for (let i = from; i <= to; i++) next.add(allIds[i]);
            return next;
          }
        }
        // Plain click toggles
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClicked(id);
    },
    [allIds, lastClicked],
  );

  function selectAll() {
    setSelected(new Set(allIds));
  }
  function selectNone() {
    setSelected(new Set());
  }
  function invert() {
    setSelected(new Set(allIds.filter((id) => !selected.has(id))));
  }

  const count = selected.size;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={selectAll}
          className="rounded px-2 py-1 font-medium text-ink-600 hover:bg-ink-100"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={selectNone}
          disabled={count === 0}
          className="rounded px-2 py-1 font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={invert}
          className="rounded px-2 py-1 font-medium text-ink-600 hover:bg-ink-100"
        >
          Invert
        </button>
        <span className="ml-2 text-ink-500">
          {count === 0 ? 'No selection' : `${count} selected`}
        </span>
        <div className="ml-auto flex gap-2">
          {allowReorder && (
            <button
              type="button"
              onClick={() => onBulkAction?.('reorder', Array.from(selected))}
              disabled={count < 2}
              className="rounded bg-ink-200 px-3 py-1 font-semibold text-ink-700 hover:bg-ink-300 disabled:opacity-40"
            >
              Reorder selected
            </button>
          )}
          {allowExport && (
            <button
              type="button"
              onClick={() => onBulkAction?.('export', Array.from(selected))}
              disabled={count === 0}
              className="rounded bg-pulse-100 px-3 py-1 font-semibold text-pulse-700 hover:bg-pulse-200 disabled:opacity-40"
            >
              Export selected
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${count} selected question${count === 1 ? '' : 's'}? This cannot be undone.`)) {
                onBulkAction?.('delete', Array.from(selected));
                setSelected(new Set());
              }
            }}
            disabled={count === 0}
            className="rounded bg-critical-400 px-3 py-1 font-semibold text-white hover:bg-critical-500 disabled:opacity-40"
          >
            Delete selected
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {allIds.map((id) => renderRow(id, selected.has(id), handleRowClick(id)))}
      </div>
    </div>
  );
}
