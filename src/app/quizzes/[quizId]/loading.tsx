// File: src/app/quizzes/[quizId]/loading.tsx
// Content-shaped skeleton mirroring the quiz detail layout (title block,
// meta chips, action buttons) so the hydration swap does not shift layout.

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-9 w-3/4 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-4 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-ink-100" aria-hidden="true" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-ink-100" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-7 rounded-2xl border border-ink-100 bg-white/95 p-5 shadow-sm sm:p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-11 w-36 animate-pulse rounded-xl bg-ink-100" aria-hidden="true" />
          <div className="h-11 w-28 animate-pulse rounded-xl bg-ink-100" aria-hidden="true" />
        </div>
      </div>
      <span className="sr-only">Loading quiz…</span>
    </div>
  );
}
