// src/components/quiz/KeyboardNav.ts
'use client';

/**
 * Feature #7 - Keyboard-first navigation in QuizRunner.
 *
 * Provides a hook that wires keyboard shortcuts to quiz-taking
 * callbacks. All shortcuts are no-ops if the user is typing in a
 * text input / textarea / contenteditable (so the same keys still
 * type normally).
 *
 * Shortcuts (also documented in ShortcutsHelpPanel.tsx):
 *   J / ArrowRight / ArrowDown  -> next question
 *   K / ArrowLeft / ArrowUp      -> previous question
 *   1..9                         -> select option N (mcq / true_false)
 *   F                            -> toggle flag-for-review
 *   Enter                        -> submit (if a confirm modal isn't shown)
 *
 * Pure client-side, no state, no DB.
 */
import { useEffect } from 'react';

export interface KeyboardNavHandlers {
  next: () => void;
  prev: () => void;
  selectOption: (index: number) => void;
  toggleFlag: () => void;
  submit: () => void;
  /** When false (e.g. results screen open), the hook is disabled. */
  enabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.isContentEditable;
}

export function useQuizKeyboardNav(handlers: KeyboardNavHandlers) {
  const enabled = handlers.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      // Ignore modifier-combos so browser shortcuts (Cmd+R etc.) still work.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'j' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handlers.next();
      } else if (key === 'k' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlers.prev();
      } else if (key === 'f') {
        e.preventDefault();
        handlers.toggleFlag();
      } else if (key === 'enter') {
        e.preventDefault();
        handlers.submit();
      } else if (/^[1-9]$/.test(key)) {
        const idx = Number(key) - 1;
        e.preventDefault();
        handlers.selectOption(idx);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, handlers]);
}
