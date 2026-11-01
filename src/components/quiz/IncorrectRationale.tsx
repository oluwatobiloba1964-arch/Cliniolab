// File: src/components/quiz/IncorrectRationale.tsx
/**
 * Optional "why the other options are wrong" note shown under the normal
 * explanation. Renders nothing when the question has no note. Collapsed
 * behind a <details> dropdown so review cards stay short by default.
 */
export function IncorrectRationale({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <details className="mt-2 group rounded-md border border-flag-200 bg-flag-50 p-3">
      <summary className="cursor-pointer select-none list-none text-xs font-semibold uppercase tracking-wide text-flag-700 flex items-center justify-between gap-2">
        Why the other options are wrong
        <span className="text-flag-500 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-600">{text}</p>
    </details>
  );
}
