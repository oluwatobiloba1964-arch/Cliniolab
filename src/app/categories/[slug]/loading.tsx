// File: src/app/categories/[slug]/loading.tsx
// Content-shaped skeleton mirroring the category detail layout (category
// header + grid of subcategory/content cards).

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-9 w-56 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" aria-hidden="true" />
        ))}
      </div>
      <span className="sr-only">Loading category…</span>
    </div>
  );
}
