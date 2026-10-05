// File: src/components/search/SearchAutocomplete.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { publicFetchJson } from '@/lib/client/publicFetch';

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
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      publicFetchJson<{ suggestions?: SearchSuggestion[] }>(
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

  function submit() {
    const query = value.trim();
    if (!query) return;
    onSubmit?.();
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

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
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          className={`${compact ? 'py-2' : 'py-3.5'} min-w-0 flex-1 px-4 text-sm text-ink-800 focus:outline-none ${inputClassName}`}
        />
        <button
          type="submit"
          className={`${compact ? 'px-4' : 'min-h-12 px-6'} shrink-0 bg-pulse-600 text-sm font-semibold text-white transition-colors hover:bg-pulse-700`}
        >
          {buttonLabel}
        </button>
      </form>

      {(open && (suggestions.length > 0 || loading)) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-ink-100 bg-paper shadow-xl">
          {loading && <p className="px-4 py-3 text-xs text-ink-400">Finding matches…</p>}
          {suggestions.map((suggestion) => (
            <Link
              key={`${suggestion.type}:${suggestion.id}`}
              href={suggestion.url}
              onMouseDown={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
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
