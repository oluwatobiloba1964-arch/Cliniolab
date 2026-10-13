// src/components/study/StudySessionPresets.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { PRESETS_KEY, makeId, readJson, writeJson } from '@/lib/services/localExtrasService';

interface Preset {
  id: string;
  label: string;
  description: string;
  href: string;
  isBuiltIn: boolean;
}

const BUILT_IN: Preset[] = [
  {
    id: 'quick-15',
    label: '15 minute quiz sprint',
    description: 'One short quiz to build the habit.',
    href: '/quizzes?studyTime=15',
    isBuiltIn: true,
  },
  {
    id: 'cards-30',
    label: '30 minute flashcard sprint',
    description: 'Review cards for half an hour.',
    href: '/flashcards',
    isBuiltIn: true,
  },
  {
    id: 'mixed',
    label: 'Mixed practice',
    description: 'One quiz, then a flashcard run.',
    href: '/quizzes?studyTime=10',
    isBuiltIn: true,
  },
];

export function StudySessionPresets() {
  const [custom, setCustom] = useState<Preset[]>([]);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftHref, setDraftHref] = useState('');

  useEffect(() => {
    setCustom(readJson<Preset[]>(PRESETS_KEY, []));
  }, []);

  function persist(next: Preset[]) {
    setCustom(next);
    writeJson(PRESETS_KEY, next);
  }

  function addPreset() {
    const label = draftLabel.trim();
    const href = draftHref.trim();
    if (!label || !href) return;
    const preset: Preset = {
      id: makeId(),
      label,
      description: 'Saved on this device',
      href: href.startsWith('/') ? href : `/${href}`,
      isBuiltIn: false,
    };
    persist([...custom, preset]);
    setDraftLabel('');
    setDraftHref('');
  }

  function removePreset(id: string) {
    persist(custom.filter((p) => p.id !== id));
  }

  const all = [...BUILT_IN, ...custom];

  return (
    <Card className="p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">
          On this device
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Study session presets
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          One tap to start the kind of session you usually pick.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((preset) => (
          <div
            key={preset.id}
            className="rounded-xl border border-ink-100 bg-white p-3 transition hover:border-pulse-200 hover:shadow-sm"
          >
            <Link href={preset.href} className="block">
              <p className="text-sm font-semibold text-ink-800">{preset.label}</p>
              <p className="mt-1 text-xs text-ink-500">{preset.description}</p>
            </Link>
            {!preset.isBuiltIn && (
              <button
                type="button"
                onClick={() => removePreset(preset.id)}
                className="mt-2 text-[11px] font-semibold text-ink-400 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="Preset name"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <input
          value={draftHref}
          onChange={(e) => setDraftHref(e.target.value)}
          placeholder="Path, e.g. /quizzes?studyTime=25"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addPreset}
          className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700"
        >
          Add
        </button>
      </div>
    </Card>
  );
}
