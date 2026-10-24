// src/components/study/LocalStudyStreakHeatmap.tsx
'use client';

/**
 * Browser-only study activity heatmap. Reads studyDays / minutesByDay from the
 * existing local study toolkit record. Never calls fetch, APIs, or the database.
 */

import { useMemo } from 'react';

const WEEKS = 12;
const DAYS = 7;

function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function LocalStudyStreakHeatmap({
  studyDays,
  minutesByDay = {},
}: {
  studyDays: string[];
  minutesByDay?: Record<string, number>;
}) {
  const cells = useMemo(() => {
    const studied = new Set(studyDays);
    const today = startOfDay(new Date());
    // Align so the last column is the current week (Sun–Sat or Mon–Sun via locale weekday).
    const end = new Date(today);
    const total = WEEKS * DAYS;
    const start = new Date(today);
    start.setDate(start.getDate() - (total - 1));

    const out: { key: string; level: 0 | 1 | 2 | 3 | 4; title: string }[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      const mins = minutesByDay[key] ?? 0;
      const active = studied.has(key) || mins > 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (active) {
        if (mins >= 60) level = 4;
        else if (mins >= 30) level = 3;
        else if (mins >= 10) level = 2;
        else level = 1;
      }
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      out.push({
        key,
        level,
        title: active
          ? `${label}: ${mins > 0 ? `${mins} min studied` : 'Study day'}`
          : `${label}: no local study logged`,
      });
    }
    return out;
  }, [studyDays, minutesByDay]);

  const levelClass = [
    'bg-ink-100',
    'bg-pulse-200',
    'bg-pulse-300',
    'bg-pulse-500',
    'bg-pulse-700',
  ] as const;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Local activity</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-800">Study heatmap</p>
        </div>
        <p className="text-[11px] text-ink-400">This device only · last {WEEKS} weeks</p>
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: `repeat(${DAYS}, 0.7rem)` }}
        role="img"
        aria-label="Study activity heatmap for the last twelve weeks"
      >
        {cells.map((cell) => (
          <div
            key={cell.key}
            title={cell.title}
            className={`rounded-sm ${levelClass[cell.level]}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-ink-400">
        <span>Less</span>
        {levelClass.map((cls, i) => (
          <span key={cls} className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} aria-hidden="true" />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
