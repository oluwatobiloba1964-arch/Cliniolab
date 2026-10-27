// src/components/quiz/CBTExamSkin.tsx
'use client';

/**
 * Feature #6 - Realistic CBT exam interface skin.
 *
 * Wraps QuizRunner's content with a Nigerian Nursing Council-style
 * CBT simulator look: numbered question grid on the right, timer
 * top-right, "Flag for review" button, monochrome palette. Purely
 * presentational, no behavior change.
 *
 * Toggle via passing `enabled` prop. Designed to be composed inside
 * QuizRunner when quiz.mode === 'exam'.
 */
import { ReactNode } from 'react';

interface CBTExamSkinProps {
  enabled: boolean;
  /** Question grid sidebar (existing QuestionNavigator). */
  navigator: ReactNode;
  /** Timer display. */
  timer: ReactNode;
  /** Flag-for-review button. */
  flagButton?: ReactNode;
  /** The actual question content (prompt + options). */
  children: ReactNode;
}

export function CBTExamSkin({ enabled, navigator, timer, flagButton, children }: CBTExamSkinProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="cbt-skin mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {/* CBT header bar */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-ink-300 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded bg-ink-900 font-display text-sm font-bold text-white">
            C
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">CBT Exam Simulator</p>
            <p className="text-[10px] text-ink-400">Cliniolab · Nursing &amp; Clinical Exam Practice</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {flagButton}
          {timer}
        </div>
      </div>

      {/* Body: 2-column on desktop, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
          {children}
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-700">Question grid</p>
            {navigator}
          </div>
        </aside>
      </div>
    </div>
  );
}
