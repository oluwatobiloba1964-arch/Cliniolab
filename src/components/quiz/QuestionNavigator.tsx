// File: src/components/quiz/QuestionNavigator.tsx
/*
 * CHANGE SUMMARY (QuestionNavigator.tsx)
 * - New optional props: skipped/highlighted question states, plus an inline
 *   actionLabel/onAction/actionDisabled button and a summary line, so callers
 *   (QuizRunner, StudyModeRunner) can embed a "Submit"/"Finish" button directly
 *   in the navigator card instead of a separate button elsewhere.
 * - Fully backward compatible: all new props optional, existing callers unaffected.
 * Note: the `highlighted` prop is declared but never used in the render logic
 * (dead prop) -- harmless, but flagging in case it was meant to do something.
 * Reviewed: balanced braces. Approved as-is.
 */
'use client';

/**
 * CBT-style question navigator grid, shared across Study, Quiz, and Exam
 * modes. Shows every question number so the user can jump directly to any
 * question, and color-codes each number by status (current / answered /
 * flagged / unanswered) the way standard computer-based testing UIs do.
 */
export interface NavigatorQuestionState {
  answered: boolean;
  flagged?: boolean;
  skipped?: boolean;
  highlighted?: boolean;
  /**
   * Feature #3 - Ghost answer marker. When set, this question was
   * answered on a previous attempt; the navigator renders a small
   * ghost dot (light grey) in the corner so the learner can see at
   * a glance which questions they have already engaged with on a
   * prior run. Pure visual aid, no behavior change.
   */
  previouslyAnswered?: boolean;
}

interface QuestionNavigatorProps {
  total: number;
  current: number; // 0-indexed
  states: NavigatorQuestionState[];
  onJump: (index: number) => void;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  summary?: string;
}

export function QuestionNavigator({
  total,
  current,
  states,
  onJump,
  className = '',
  actionLabel,
  onAction,
  actionDisabled = false,
  summary,
}: QuestionNavigatorProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-xs text-ink-400">
        <LegendDot className="bg-pulse-500" label="Current" />
        <LegendDot className="bg-pulse-100 ring-1 ring-inset ring-pulse-300" label="Answered" />
        <LegendDot className="bg-flag-400" label="Flagged" />
        <LegendDot className="bg-amber-100 ring-1 ring-inset ring-amber-300" label="Skipped" />
        <LegendDot className="bg-white ring-1 ring-inset ring-ink-200" label="Unanswered" />
        <LegendDot className="bg-ink-200" label="Prior attempt" />
      </div>
      {summary && <p className="mb-3 text-xs text-ink-500">{summary}</p>}
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: total }, (_, i) => {
          const state = states[i] ?? { answered: false, flagged: false };
          const isCurrent = i === current;

          let classes =
            'relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors';
          if (isCurrent) {
            classes += ' bg-pulse-500 text-white';
          } else if (state.flagged) {
            classes += ' bg-flag-50 text-flag-700 ring-1 ring-inset ring-flag-300 hover:bg-flag-100';
          } else if (state.answered) {
            classes += ' bg-pulse-50 text-pulse-700 ring-1 ring-inset ring-pulse-300 hover:bg-pulse-100';
          } else if (state.skipped) {
            classes += ' bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-300 hover:bg-amber-100';
          } else {
            classes += ' bg-white text-ink-500 ring-1 ring-inset ring-ink-200 hover:bg-ink-50';
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to question ${i + 1}${state.answered ? ', answered' : state.skipped ? ', skipped' : ', unanswered'}${state.flagged ? ', flagged' : ''}${state.previouslyAnswered ? ', answered on a prior attempt' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={classes}
            >
              {i + 1}
              {state.flagged && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-flag-400" />
              )}
              {state.previouslyAnswered && !state.flagged && (
                <span
                  className="absolute -left-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full bg-ink-300"
                  aria-hidden="true"
                  title="Answered on a prior attempt"
                />
              )}
            </button>
          );
        })}
      </div>
      {actionLabel && onAction && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-400">Select any number to revisit that question.</p>
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="min-h-11 rounded-lg bg-pulse-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pulse-700 focus:outline-none focus:ring-2 focus:ring-pulse-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
