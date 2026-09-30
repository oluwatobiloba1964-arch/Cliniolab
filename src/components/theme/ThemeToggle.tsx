'use client';

import { useTheme } from './useTheme';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';

const OPTIONS: { key: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: '☀' },
  { key: 'dark', label: 'Dark', icon: '☾' },
  { key: 'system', label: 'System', icon: '◐' },
];

/** Compact three-way theme switch. Renders nothing if the admin turned it off. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { flags } = usePublicConfig();
  if (!flags.darkMode) return null;

  return (
    <div className="flex items-center rounded-full border border-ink-100 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-label={`${opt.label} theme`}
          title={`${opt.label} theme`}
          onClick={() => setTheme(opt.key)}
          className={`grid h-7 w-7 place-items-center rounded-full text-sm transition-colors ${
            theme === opt.key ? 'bg-pulse-500 text-white' : 'text-ink-400 hover:text-ink-700'
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
