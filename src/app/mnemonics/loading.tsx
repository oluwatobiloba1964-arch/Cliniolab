// File: src/app/mnemonics/loading.tsx
// Loading skeleton that mirrors the shape of the mnemonics page.

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
        <div className="mt-2 h-8 w-48 animate-pulse rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-ink-100" />
        <div className="mt-2 h-4 w-2/3 max-w-md animate-pulse rounded bg-ink-100" />
      </header>
      <div className="mt-8">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-ink-100 bg-white p-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded-full bg-ink-100" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-ink-100 bg-white shadow-sm">
              <div className="border-b border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="h-2 w-16 animate-pulse rounded bg-ink-100" />
                <div className="mt-1.5 h-5 w-24 animate-pulse rounded bg-ink-100" />
              </div>
              <div className="px-4 py-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3 py-2">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-ink-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-32 animate-pulse rounded bg-ink-100" />
                      <div className="h-2 w-48 animate-pulse rounded bg-ink-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
