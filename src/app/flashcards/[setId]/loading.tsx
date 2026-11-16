// File: src/app/flashcards/[setId]/loading.tsx
// Content-shaped skeleton mirroring the flashcard set detail layout.

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-9 w-2/3 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-4 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-ink-100" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-7 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-ink-100 bg-ink-50"
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="sr-only">Loading flashcards…</span>
    </div>
  );
}
