// File: src/components/study/MissReasonJournal.tsx
'use client';

import { useState } from 'react';
import { MISS_REASONS, MISS_REASON_LABELS, saveMissReason, type MissReason } from '@/lib/services/localInsightsService';

type Props = {
  questionId: string;
  quizId: string;
  quizTitle: string;
  prompt: string;
  onSaved?: (reason: MissReason) => void;
};

export function MissReasonJournal({ questionId, quizId, quizTitle, prompt, onSaved }: Props) {
  const [selected, setSelected] = useState<MissReason | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSelect = (reason: MissReason) => {
    setSelected(reason);
    const ok = saveMissReason({
      questionId,
      quizId,
      quizTitle,
      prompt: prompt.slice(0, 200),
      reason,
      savedAt: new Date().toISOString(),
    });
    if (ok) {
      setSaved(true);
      onSaved?.(reason);
      window.setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
          Why did you miss this?
        </p>
        {saved && <span className="text-[10px] font-semibold text-pulse-600">Saved</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MISS_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => handleSelect(reason)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              selected === reason
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
            }`}
          >
            {MISS_REASON_LABELS[reason]}
          </button>
        ))}
      </div>
    </div>
  );
}
