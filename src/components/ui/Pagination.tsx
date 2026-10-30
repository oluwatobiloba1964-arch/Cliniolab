'use client';

import { Button } from '@/components/ui/Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, className = '' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  // Compact page-number list: always show first, last, current, and one
  // neighbor on each side; collapse the rest into an ellipsis.
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-ink-400">
        Showing {rangeStart} to {rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1.5 text-sm text-ink-300">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'true' : undefined}
              className={`h-8 min-w-8 rounded-md px-2 text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-pulse-500 text-white'
                  : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}
