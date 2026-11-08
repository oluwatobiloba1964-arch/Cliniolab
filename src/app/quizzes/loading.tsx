// File: src/app/quizzes/loading.tsx
// Content-shaped skeleton that mirrors the quiz listing layout so the
// hydration swap does not cause a layout shift on slower connections.

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-9 w-48 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-ink-100" aria-hidden="true" />
      </div>
      <div className="mt-7 rounded-2xl border border-ink-100 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-ink-100" aria-hidden="true" />
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" aria-hidden="true" />
        ))}
      </div>
      <span className="sr-only">Loading quizzes…</span>
    </div>
  );
}
