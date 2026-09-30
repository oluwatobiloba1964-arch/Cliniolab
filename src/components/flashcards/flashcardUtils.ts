import type { FlashcardRunnerCard } from './FlashcardRunner';

export function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** Lenient typed-answer check: ignores case/punctuation and tolerates small typos. */
export function isTypedAnswerCorrect(typed: string, expected: string): boolean {
  const a = normalizeAnswer(typed);
  const b = normalizeAnswer(expected);
  if (!a) return false;
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return false;
  return levenshtein(a, b) / maxLen <= 0.15;
}

/** Up to `count` distractor cards, never the target and never with an identical back. */
export function pickDistractors(cards: FlashcardRunnerCard[], target: FlashcardRunnerCard, count: number): FlashcardRunnerCard[] {
  const pool = cards.filter((c) => c.id !== target.id && normalizeAnswer(c.back) !== normalizeAnswer(target.back));
  return shuffled(pool).slice(0, count);
}
