'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'cl-theme';

function resolve(mode: ThemeChoice): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function apply(mode: ThemeChoice) {
  const resolved = resolve(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/** Reads/writes the user's theme choice (light/dark/system), persisted per device in localStorage. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>('system');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      if (stored) setThemeState(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeChoice) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  return { theme, setTheme };
}
