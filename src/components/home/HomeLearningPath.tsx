// src/components/home/HomeLearningPath.tsx
'use client';

export function HomeLearningPath() {
  const steps: [string, string, string][] = [
    ['01', 'Learn', 'Understand the concept'],
    ['02', 'Practise', 'Apply it with questions'],
    ['03', 'Review', 'Spot gaps and mistakes'],
    ['04', 'Master', 'Return until confident'],
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
      <div className="rounded-3xl bg-ink-900 p-6 text-white sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-300">
            The Cliniolab method
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Turn study time into progress.
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-300">
            Move naturally from understanding a topic to testing it, reviewing gaps and
            returning until the knowledge sticks.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {steps.map(([number, title, text], index) => (
            <div
              key={title}
              className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]"
            >
              {index < 3 && (
                <span
                  className="absolute -right-2 top-1/2 hidden h-px w-4 bg-white/20 sm:block"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono text-xs text-pulse-300">{number}</span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-ink-300">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
