// src/components/dashboard/WeeklyFocusChart.tsx
'use client';

/**
 * Feature #10 - Weekly focus time bar chart.
 *
 * Pure client-side. Reads focus minutes per day for the last 7 days
 * from localStorage. Each bar represents one day; height is scaled to
 * the maximum focus time in the window (or 60 minutes if all zero).
 *
 * No database, no API calls. Data is written by the existing
 * QuizStudyToolkit focus timer and other study activities.
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { TOOLKIT_KEY, readJson } from '@/lib/services/localExtrasService';

interface WeeklyFocusChartProps {
  /** Override the source key for testing; defaults to the toolkit record. */
  sourceKey?: string;
}

interface ToolkitData {
  focusMinutesByDay?: Record<string, number>;
  studyDays?: string[];
}

function lastSevenDayKeys(): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    keys.push(`${d.getFullYear()}-${month}-${day}`);
  }
  return keys;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

export function WeeklyFocusChart({ sourceKey }: WeeklyFocusChartProps) {
  const [minutes, setMinutes] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    const toolkit = readJson<ToolkitData>(sourceKey ?? TOOLKIT_KEY, {});
    const focusByDay = toolkit.focusMinutesByDay ?? {};
    const keys = lastSevenDayKeys();
    setLabels(keys.map(dayLabel));
    setMinutes(keys.map((k) => focusByDay[k] ?? 0));
  }, [sourceKey]);

  const total = minutes.reduce((a, b) => a + b, 0);
  const max = Math.max(60, ...minutes);
  const avg = minutes.length ? Math.round(total / minutes.length) : 0;

  if (total === 0) {
    return (
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Weekly focus</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">No focus sessions yet this week</h3>
        <p className="mt-2 text-sm text-ink-500">
          Start a focus timer from any quiz or the dashboard study toolkit. Minutes will appear here automatically.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Weekly focus</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">{total} min this week</h3>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
          avg {avg} min/day
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2 sm:gap-3" style={{ height: 140 }}>
        {minutes.map((m, i) => {
          const h = Math.max(4, Math.round((m / max) * 130));
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${
                    m === 0 ? 'bg-ink-100' : m >= 30 ? 'bg-pulse-500' : 'bg-pulse-300'
                  }`}
                  style={{ height: h }}
                  title={`${m} min`}
                  aria-label={`${labels[i]}: ${m} minutes`}
                />
              </div>
              <span className="text-[10px] font-medium text-ink-400">{labels[i]}</span>
              <span className="font-mono text-[10px] text-ink-600">{m}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
