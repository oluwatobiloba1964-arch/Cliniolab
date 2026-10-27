// src/components/dashboard/CategoryProgressRadar.tsx
'use client';

/**
 * Feature #11 - Per-category progress radar chart.
 *
 * Pure client-side. Aggregates quiz attempt answers (already in browser
 * memory after a fetch, or in localStorage via localInsightsService) into
 * a per-category accuracy radar. Helps the learner spot weak topics
 * visually.
 *
 * No database writes, no extra API calls - consumes data already loaded
 * by the dashboard page or stored locally from past sessions.
 *
 * The radar is a pure SVG polygon; no chart library dependency.
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FEATURE_KEYS, readLocal } from '@/lib/services/localFeatureService';

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
}

interface StoredProgress {
  stats: CategoryStat[];
  savedAt: number;
}

interface CategoryProgressRadarProps {
  /** Optional live stats from the parent. If provided, used directly
   *  and written back to localStorage for next load. */
  stats?: CategoryStat[];
}

export function CategoryProgressRadar({ stats }: CategoryProgressRadarProps) {
  const [resolved, setResolved] = useState<CategoryStat[]>([]);

  useEffect(() => {
    if (stats && stats.length > 0) {
      // Write back to localStorage so the next dashboard load is instant
      // and does not need to re-fetch from the API.
      const payload: StoredProgress = { stats, savedAt: Date.now() };
      try {
        window.localStorage.setItem(
          FEATURE_KEYS.categoryProgress,
          JSON.stringify(payload),
        );
      } catch {
        // Storage unavailable or full; non-blocking.
      }
      setResolved(stats);
      return;
    }
    // Read from localStorage first (cache-first). If empty, render
    // nothing - the parent will populate on its next fetch.
    const stored = readLocal<StoredProgress | null>(FEATURE_KEYS.categoryProgress, null);
    if (stored?.stats?.length) {
      setResolved(stored.stats);
    }
  }, [stats]);

  if (resolved.length < 3) {
    // Need at least 3 axes for a meaningful radar.
    return null;
  }

  const top = resolved.slice(0, 8);
  const maxTotal = Math.max(...top.map((s) => s.total), 1);
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;

  const pointFor = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / top.length - Math.PI / 2;
    const ratio = value / maxTotal;
    return {
      x: cx + Math.cos(angle) * r * ratio,
      y: cy + Math.sin(angle) * r * ratio,
    };
  };

  const labelFor = (i: number) => {
    const angle = (Math.PI * 2 * i) / top.length - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * (r + 18),
      y: cy + Math.sin(angle) * (r + 18),
    };
  };

  // Polygon points: each vertex is the accuracy ratio along its axis.
  const polygonPoints = top
    .map((s, i) => {
      const accuracy = s.total > 0 ? s.correct / s.total : 0;
      const p = pointFor(i, accuracy * maxTotal);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const weakest = [...top].sort((a, b) => {
    const aa = a.total > 0 ? a.correct / a.total : 0;
    const bb = b.total > 0 ? b.correct / b.total : 0;
    return aa - bb;
  })[0];

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Category strength</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Where are you strong vs weak?</h3>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
          {top.length} categories
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {/* concentric rings */}
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <circle
              key={ring}
              cx={cx}
              cy={cy}
              r={r * ring}
              fill="none"
              stroke="#e8eef1"
              strokeWidth={1}
            />
          ))}
          {/* axes */}
          {top.map((_, i) => {
            const p = pointFor(i, maxTotal);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke="#e8eef1"
                strokeWidth={1}
              />
            );
          })}
          {/* accuracy polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(47, 143, 122, 0.18)"
            stroke="#2f8f7a"
            strokeWidth={2}
          />
          {/* vertices */}
          {top.map((s, i) => {
            const accuracy = s.total > 0 ? s.correct / s.total : 0;
            const p = pointFor(i, accuracy * maxTotal);
            return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2f8f7a" />;
          })}
          {/* labels */}
          {top.map((s, i) => {
            const lp = labelFor(i);
            return (
              <text
                key={i}
                x={lp.x}
                y={lp.y}
                fontSize={10}
                fill="#4c7386"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {s.category.length > 12 ? s.category.slice(0, 11) + '…' : s.category}
              </text>
            );
          })}
        </svg>

        <div className="flex-1 text-sm">
          {weakest && (
            <div className="rounded-lg border border-critical-100 bg-critical-50/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-critical-600">Weakest spot</p>
              <p className="mt-1 font-semibold text-ink-800">{weakest.category}</p>
              <p className="mt-0.5 font-mono text-xs text-ink-500">
                {weakest.correct}/{weakest.total} correct ·{' '}
                {weakest.total > 0 ? Math.round((weakest.correct / weakest.total) * 100) : 0}%
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-500">
            Accuracy shown along each axis. Larger polygon = stronger overall coverage. Cached locally so reloads are instant.
          </p>
        </div>
      </div>
    </Card>
  );
}
