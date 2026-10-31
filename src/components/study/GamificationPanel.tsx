// File: src/components/study/GamificationPanel.tsx
'use client';

/**
 * Feature: local XP, levels, streaks and badges.
 *
 * Pure client-side. Reads the same localStorage keys already written by
 * the quiz runner, study toolkit and flashcard runner. No database, no
 * API calls. Renders nothing on a fresh device with no activity yet.
 */

import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Brain,
  CheckCheck,
  Clock,
  Flame,
  Footprints,
  Layers,
  Sparkles,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  getGamificationState,
  type BadgeDefinition,
  type GamificationState,
} from '@/lib/services/gamificationService';

const BADGE_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  'book-open': BookOpen,
  brain: Brain,
  target: Target,
  award: Award,
  flame: Flame,
  zap: Zap,
  layers: Layers,
  sparkles: Sparkles,
  clock: Clock,
  'check-check': CheckCheck,
  trophy: Trophy,
};

export function GamificationPanel() {
  const [state, setState] = useState<GamificationState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setState(getGamificationState());
    } catch {
      // Gamification is a nicety and must never break the dashboard.
    }
    setReady(true);
  }, []);

  if (!ready || !state) return null;

  const { level, streak, badges } = state;
  const unlockedCount = badges.filter((badge) => badge.unlocked).length;
  const xpPct = level.isMaxLevel
    ? 100
    : Math.min(100, Math.round((level.xpIntoLevel / Math.max(1, level.xpForNextLevel)) * 100));

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
              Progress and milestones
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Your learning journey</h3>
          </div>
          <span className="rounded-full bg-ink-50 px-3 py-1 text-[10px] font-semibold text-ink-400">
            Device only · no sync
          </span>
        </div>

        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          {/* Level ring */}
          <div className="flex flex-col items-center">
            <div
              className="relative grid h-28 w-28 place-items-center rounded-full text-pulse-500"
              style={{
                background: `conic-gradient(currentColor ${xpPct}%, #e8eef1 ${xpPct}% 100%)`,
                boxShadow: '0 0 0 6px rgba(255,255,255,0.9), 0 8px 20px rgba(15,37,49,0.08)',
              }}
              aria-label={`Level ${level.level}, ${level.name}`}
            >
              <div className="grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full bg-white shadow-inner">
                <div className="text-center">
                  <p className="font-mono text-2xl font-semibold leading-none text-ink-900">{level.level}</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-400">level</p>
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-ink-800">{level.name}</p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-700">
                {level.isMaxLevel ? 'Max level reached' : `${level.xpIntoLevel} / ${level.xpForNextLevel} XP to level ${level.level + 1}`}
              </span>
              <span className="font-mono font-semibold text-pulse-700">{state.totalXp.toLocaleString('en-NG')} XP</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-pulse-500 transition-all" style={{ width: `${xpPct}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-center">
                <p className="flex items-center justify-center gap-1 font-mono text-lg font-semibold text-ink-900">
                  <Flame aria-hidden="true" className="h-4 w-4 text-flag-500" />
                  {streak.current}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  day streak
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-semibold text-ink-900">{state.quizCount}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  quizzes done
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-semibold text-ink-900">
                  {Math.floor(state.studyMinutes / 60)}h {state.studyMinutes % 60}m
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  focus time
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-ink-500">
              Earn XP by finishing quizzes, clearing flashcard reviews and logging focus time.{' '}
              {streak.activeToday
                ? 'Today is already counted. Keep the streak alive tomorrow.'
                : streak.current > 0
                  ? 'Complete any quiz or focus session today to keep your streak.'
                  : 'Finish a quiz or a focus session to start a new streak.'}
            </p>
          </div>
        </div>

        {/* Badge grid */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-pulse-600">Badges</p>
            <span className="font-mono text-xs font-semibold text-ink-500">
              {unlockedCount} / {badges.length}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {badges.map((badge) => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BadgeTile({ badge }: { badge: BadgeDefinition }) {
  const Icon = BADGE_ICONS[badge.icon] ?? Award;
  const pct = Math.min(100, Math.round((badge.current / Math.max(1, badge.target)) * 100));

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        badge.unlocked
          ? 'border-pulse-200 bg-pulse-50/70'
          : 'border-ink-100 bg-white'
      }`}
      title={badge.unlocked ? `${badge.title}: unlocked` : `${badge.title}: ${badge.current} of ${badge.target}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            badge.unlocked ? 'bg-pulse-500 text-white' : 'bg-ink-100 text-ink-400'
          }`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-xs font-semibold ${badge.unlocked ? 'text-pulse-800' : 'text-ink-600'}`}>
            {badge.title}
          </p>
          <p className="truncate text-[10px] leading-4 text-ink-400">{badge.description}</p>
        </div>
      </div>
      {!badge.unlocked && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-flag-300 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 font-mono text-[10px] font-semibold text-ink-400">
            {badge.current} / {badge.target}
          </p>
        </div>
      )}
    </div>
  );
}
