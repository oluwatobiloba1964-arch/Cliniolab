'use client';

// src/components/dashboard/CollapsibleSection.tsx
//
// Wraps a dashboard section behind a collapsed-by-default header so the
// page is short on load, instead of the full "Learning overview / Study
// tools / Clinical practice / Score history" stack always being rendered
// in full before "My quizzes" and "My flashcards" ever come into view.
// The quick-jump nav at the top of the dashboard still scrolls straight to
// a section's header by #id either way — this only changes whether that
// section's BODY is open by default, not whether it can be reached.
//
// Each instance remembers its own open/closed state in localStorage per
// section id, so a person who always opens "Clinical practice" doesn't
// have to re-open it on every visit, while a fresh/first-time visitor
// still gets the short, collapsed-by-default dashboard.
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const STORAGE_PREFIX = 'cliniolab:dashboard-section-open:';

export function CollapsibleSection({
  id,
  title,
  icon,
  subtitle,
  defaultOpen = false,
  className = '',
  children,
}: {
  id: string;
  title: string;
  icon?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Read the remembered state once on mount (after hydration, so SSR and
  // first client render match and React doesn't warn about a mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + id);
      if (saved === '1') setOpen(true);
      else if (saved === '0') setOpen(false);
    } catch {
      // localStorage unavailable (private mode, etc.) — just keep defaultOpen.
    }
  }, [id]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + id, next ? '1' : '0');
      } catch {
        // best-effort only
      }
      return next;
    });
  };

  return (
    <div id={id} className={`mt-5 scroll-mt-6 sm:mt-6 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink-100/80 bg-white/90 px-4 py-3.5 text-left shadow-sm transition hover:border-pulse-200 hover:bg-pulse-50/50 focus:outline-none focus:ring-2 focus:ring-pulse-300 sm:px-5 sm:py-4"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {icon && <span aria-hidden="true" className="text-lg">{icon}</span>}
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold text-ink-900 sm:text-lg">{title}</span>
            {subtitle && <span className="mt-0.5 block text-xs text-ink-400">{subtitle}</span>}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={`${id}-panel`} className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}
