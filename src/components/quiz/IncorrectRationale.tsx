/**
 * Optional "why the other options are wrong" note shown under the normal
 * explanation. Renders nothing when the question has no note.
 */
export function IncorrectRationale({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <div className="mt-2 rounded-md border border-flag-200 bg-flag-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-flag-700">Why the other options are wrong</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-600">{text}</p>
    </div>
  );
}
