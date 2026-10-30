// File: src/components/study/ScoreTrendChart.tsx
// Browser-only score trend. Reads the score history already saved by the
// quiz runner and draws a small SVG line chart. No chart library, no
// database, no API calls. Renders nothing with fewer than 2 attempts.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getScoreHistory, type ScoreEntry } from '@/lib/services/localInsightsService';

const W = 560;
const H = 180;
const PAD_X = 34;
const PAD_Y = 18;

type Point = { x: number; y: number; pct: number; title: string; savedAt: string };

export function ScoreTrendChart() {
  const [history, setHistory] = useState<ScoreEntry[] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setHistory(getScoreHistory());
    } catch {
      // Insights are a nicety and must never break the dashboard.
    }
    setReady(true);
  }, []);

  const chart = useMemo(() => {
    if (!history || history.length < 2) return null;
    // Oldest first, keep the last 20 attempts for readability.
    const entries = history.slice(0, 20).slice().reverse();
    const points: Point[] = entries.map((entry, index) => ({
      x: PAD_X + (index / (entries.length - 1)) * (W - PAD_X * 2),
      y: PAD_Y + (1 - Math.max(0, Math.min(100, entry.percentage)) / 100) * (H - PAD_Y * 2),
      pct: Math.round(entry.percentage),
      title: entry.quizTitle,
      savedAt: entry.savedAt,
    }));

    const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${PAD_X},${H - PAD_Y} ${line} ${(W - PAD_X).toFixed(1)},${H - PAD_Y}`;
    const average = Math.round(points.reduce((sum, p) => sum + p.pct, 0) / points.length);
    const avgY = PAD_Y + (1 - average / 100) * (H - PAD_Y * 2);

    // Momentum: last half versus previous half.
    const half = Math.floor(points.length / 2);
    const recentAvg =
      points.slice(points.length - half).reduce((sum, p) => sum + p.pct, 0) / Math.max(1, half);
    const earlierAvg = points.slice(0, points.length - half).reduce((sum, p) => sum + p.pct, 0) /
      Math.max(1, points.length - half);
    const momentum = Math.round(recentAvg - earlierAvg);
    const best = points.reduce((best, p) => (p.pct > best.pct ? p : best), points[0]);

    return { points, line, area, average, avgY, momentum, best };
  }, [history]);

  if (!ready || !chart) return null;

  const improving = chart.momentum >= 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Score trend</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Your last {chart.points.length} quizzes</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            improving ? 'bg-pulse-50 text-pulse-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {improving ? (
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {improving ? '+' : ''}
          {chart.momentum}% momentum
        </span>
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Score trend across your last ${chart.points.length} quizzes, average ${chart.average} percent, best ${chart.best.pct} percent`}
        >
          {/* Grid lines at 0, 50 and 100 percent */}
          {[0, 50, 100].map((value) => {
            const y = PAD_Y + (1 - value / 100) * (H - PAD_Y * 2);
            return (
              <g key={value}>
                <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#e8eef1" strokeWidth="1" />
                <text x={PAD_X - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ab0bc">
                  {value}
                </text>
              </g>
            );
          })}

          {/* Average line */}
          <line
            x1={PAD_X}
            y1={chart.avgY}
            x2={W - PAD_X}
            y2={chart.avgY}
            stroke="#7fb5a8"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />

          {/* Area fill and line */}
          <polygon points={chart.area} fill="url(#trendFill)" />
          <polyline
            points={chart.line}
            fill="none"
            stroke="#2f8f7a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f8f7a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2f8f7a" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Points, best attempt highlighted */}
          {chart.points.map((p) => {
            const isBest = p === chart.best;
            return (
              <circle
                key={`${p.savedAt}-${p.x}`}
                cx={p.x}
                cy={p.y}
                r={isBest ? 5 : 3.5}
                fill={isBest ? '#2f8f7a' : '#ffffff'}
                stroke="#2f8f7a"
                strokeWidth="2"
              >
                <title>{`${p.title}: ${p.pct}%`}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="font-mono text-sm font-semibold text-ink-900">{chart.average}%</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">average</p>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="font-mono text-sm font-semibold text-pulse-700">{chart.best.pct}%</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink-400" title={chart.best.title}>
            best attempt
          </p>
        </div>
        <div className="col-span-2 rounded-lg bg-ink-50 px-3 py-2 sm:col-span-1">
          <p className="font-mono text-sm font-semibold text-ink-900">{chart.points.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">attempts shown</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-400">
        Stored on this device from your quiz results. Dashed line shows your average.
      </p>
    </Card>
  );
}
