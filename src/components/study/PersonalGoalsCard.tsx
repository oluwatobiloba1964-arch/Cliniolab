// src/components/study/PersonalGoalsCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { GOALS_KEY, makeId, readJson, writeJson } from '@/lib/services/localExtrasService';

interface Goal {
  id: string;
  text: string;
  target: number;
  progress: number;
  unit: string;
  createdAt: string;
}

export function PersonalGoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [draftText, setDraftText] = useState('');
  const [draftTarget, setDraftTarget] = useState(10);
  const [draftUnit, setDraftUnit] = useState('questions');

  useEffect(() => {
    setGoals(readJson<Goal[]>(GOALS_KEY, []));
  }, []);

  function persist(next: Goal[]) {
    setGoals(next);
    writeJson(GOALS_KEY, next);
  }

  function addGoal() {
    const text = draftText.trim();
    if (!text) return;
    const target = Math.max(1, Math.min(10000, Math.round(draftTarget) || 1));
    const goal: Goal = {
      id: makeId(),
      text,
      target,
      progress: 0,
      unit: draftUnit.trim() || 'items',
      createdAt: new Date().toISOString(),
    };
    persist([goal, ...goals]);
    setDraftText('');
    setDraftTarget(10);
    setDraftUnit('questions');
  }

  function bump(id: string, delta: number) {
    persist(
      goals.map((g) =>
        g.id === id
          ? { ...g, progress: Math.max(0, Math.min(g.target, g.progress + delta)) }
          : g
      )
    );
  }

  function remove(id: string) {
    persist(goals.filter((g) => g.id !== id));
  }

  return (
    <Card className="p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
          On this device
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Personal study goals
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Small commitments you track yourself. Nothing is uploaded.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.round((g.progress / g.target) * 100) : 0;
          return (
            <li key={g.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{g.text}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {g.progress} of {g.target} {g.unit}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => bump(g.id, -1)}
                    className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-500"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => bump(g.id, 1)}
                    className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-700"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => bump(g.id, 5)}
                    className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-700"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-400 hover:border-red-300 hover:text-red-600"
                  >
                    x
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-pulse-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
        {goals.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500">
            No goals yet. Add one below.
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="What do you want to finish?"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          value={draftTarget}
          onChange={(e) => setDraftTarget(Number(e.target.value))}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <input
          value={draftUnit}
          onChange={(e) => setDraftUnit(e.target.value)}
          placeholder="Unit"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addGoal}
          className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700"
        >
          Add
        </button>
      </div>
    </Card>
  );
}
