// src/components/blog/ArticleDisplayToggle.tsx
'use client';

import { useEffect, useState } from 'react';
import { ARTICLE_DISPLAY_KEY, readJson, writeJson } from '@/lib/services/localExtrasService';

type Mode = 'default' | 'sepia' | 'contrast';

export function ArticleDisplayToggle({ onChange }: { onChange: (mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>('default');

  useEffect(() => {
    const stored = readJson<{ mode: Mode }>(ARTICLE_DISPLAY_KEY, { mode: 'default' });
    setMode(stored.mode);
    onChange(stored.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(next: Mode) {
    setMode(next);
    writeJson(ARTICLE_DISPLAY_KEY, { mode: next });
    onChange(next);
  }

  const options: { key: Mode; label: string }[] = [
    { key: 'default', label: 'Default' },
    { key: 'sepia', label: 'Sepia' },
    { key: 'contrast', label: 'Contrast' },
  ];

  return (
    <div className="article-display-toggle inline-flex overflow-hidden rounded-full border border-ink-200 bg-white">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => pick(opt.key)}
          className={`px-3 py-1 text-xs font-semibold transition ${
            mode === opt.key ? 'bg-ink-800 text-white' : 'text-ink-500 hover:bg-ink-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
