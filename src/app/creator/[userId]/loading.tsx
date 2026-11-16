// File: src/app/creator/[userId]/loading.tsx
// Profile-shaped skeleton (avatar, name, bio, stats row, content grid)
// mirroring the creator profile layout.

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="h-20 w-20 animate-pulse rounded-2xl bg-ink-100 sm:h-24 sm:w-24" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          <div className="h-7 w-48 animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink-100" aria-hidden="true" />
          <div className="h-4 w-56 animate-pulse rounded bg-ink-100" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-7 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-ink-100 bg-ink-50" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-9 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-ink-100 bg-white/95" aria-hidden="true" />
        ))}
      </div>
      <span className="sr-only">Loading creator profile…</span>
    </div>
  );
}
