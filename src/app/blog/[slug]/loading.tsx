// File: src/app/blog/[slug]/loading.tsx
// Article-shaped skeleton (title, byline, hero image block, paragraphs)
// so the hydration swap does not shift layout.

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
      <div className="mt-3 h-10 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
      <div className="mt-2 h-10 w-2/3 animate-pulse rounded bg-ink-100" aria-hidden="true" />
      <div className="mt-5 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-ink-100" aria-hidden="true" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-8 h-56 w-full animate-pulse rounded-2xl bg-ink-100 sm:h-72" aria-hidden="true" />
      <div className="mt-8 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-ink-100"
            style={{ width: `${88 - (i % 3) * 12}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="sr-only">Loading article…</span>
    </div>
  );
}
