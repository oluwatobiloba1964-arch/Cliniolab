// File: src/app/blog/loading.tsx
// Content-shaped skeleton that mirrors the blog listing layout so the
// hydration swap does not cause a layout shift on slower connections.

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-9 w-48 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
      </div>
      {/* Featured post skeleton */}
      <div className="mt-8 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm">
        <div className="h-56 w-full animate-pulse bg-ink-100 sm:h-72" aria-hidden="true" />
        <div className="space-y-3 p-6">
          <div className="h-3 w-40 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-7 w-3/4 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-4 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        </div>
      </div>
      {/* Two-column grid skeleton */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm">
            <div className="h-36 w-full animate-pulse bg-ink-100" aria-hidden="true" />
            <div className="space-y-2 p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-ink-100" aria-hidden="true" />
              <div className="h-3 w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading articles…</span>
    </div>
  );
}
