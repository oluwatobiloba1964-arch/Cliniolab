// File: src/components/search/SearchAutocomplete.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, X } from 'lucide-react';
import { publicFetchJsonLocalCached, PUBLIC_LIST_TTL_MS } from '@/lib/client/publicFetch';

export interface SearchSuggestion {
  id: string;
  title: string;
  type: 'quiz' | 'article' | 'resource';
  url: string;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

const TYPE_LABEL: Record<SearchSuggestion['type'], string> = {
  quiz: 'Quiz',
  article: 'Article',
  resource: 'Resource',
};

const RECENT_KEY = 'cliniolab_recent_searches_v1';
const RECENT_MAX = 8;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(items: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)));
  } catch {
    // Best-effort: recent searches are a nicety and must never break the UI.
  }
}

function pushRecent(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = readRecent().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  writeRecent([trimmed, ...existing].slice(0, RECENT_MAX));
}

function clearRecent(): string[] {
  writeRecent([]);
  return [];
}

export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search quizzes, articles, resources…',
  className = '',
  inputClassName = '',
  buttonLabel = 'Search',
  autoFocus,
  compact = false,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate recent searches from localStorage on mount only — never block
  // the first paint with a sync localStorage read.
  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      publicFetchJsonLocalCached<{ suggestions?: SearchSuggestion[] }>(
        `/api/search?q=${encodeURIComponent(query)}&mode=suggest`,
        30_000,
      )
        .then((data) => {
          if (!cancelled) {
            setSuggestions(data.suggestions ?? []);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function submit(queryToSubmit?: string) {
    const query = (queryToSubmit ?? value).trim();
    if (!query) return;
    onSubmit?.();
    setOpen(false);
    pushRecent(query);
    setRecent(readRecent());
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleClearRecent() {
    setRecent(clearRecent());
  }

  const hasSuggestions = suggestions.length > 0;
  const hasRecent = !loading && value.trim().length < 3 && recent.length > 0;

  return (
    <div className={`relative ${className}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex min-w-0"
      >
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (hasSuggestions || hasRecent) setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={open && (hasSuggestions || hasRecent)}
          className={`${compact ? 'py-2' : 'py-3.5'} min-w-0 flex-1 px-4 text-sm text-ink-800 focus:outline-none ${inputClassName}`}
        />
        <button
          type="submit"
          className={`${compact ? 'px-4' : 'min-h-12 px-6'} shrink-0 bg-pulse-600 text-sm font-semibold text-white transition-colors hover:bg-pulse-700`}
        >
          {buttonLabel}
        </button>
      </form>

      {(open && (hasSuggestions || hasRecent)) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-ink-100 bg-paper shadow-xl">
          {hasRecent && (
            <div className="border-b border-ink-100">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  Recent searches
                </span>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    handleClearRecent();
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-critical-600"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Clear
                </button>
              </div>
              {recent.map((q) => (
                <button
                  key={q}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    onChange(q);
                    submit(q);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="min-w-0 truncate">{q}</span>
                </button>
              ))}
            </div>
          )}
          {loading && <p className="px-4 py-3 text-xs text-ink-400">Finding matches…</p>}
          {suggestions.map((suggestion) => (
            <Link
              key={`${suggestion.type}:${suggestion.id}`}
              href={suggestion.url}
              onMouseDown={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                pushRecent(suggestion.title);
                setRecent(readRecent());
              }}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-50"
            >
              <span className="min-w-0 truncate text-sm font-medium text-ink-800">{suggestion.title}</span>
              <span className="shrink-0 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                {TYPE_LABEL[suggestion.type]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
