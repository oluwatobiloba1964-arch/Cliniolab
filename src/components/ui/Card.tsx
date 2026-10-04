import React from 'react';
import type { QuizDifficulty } from '@/types';

export function Card({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-ink-100 bg-white shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

const difficultyEdge: Record<QuizDifficulty, string> = {
  easy: 'difficulty-edge-easy',
  medium: 'difficulty-edge-medium',
  hard: 'difficulty-edge-hard',
};

const difficultyLabel: Record<QuizDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const difficultyTextColor: Record<QuizDifficulty, string> = {
  easy: 'text-pulse-600',
  medium: 'text-flag-600',
  hard: 'text-critical-500',
};

export function DifficultyBadge({ difficulty }: { difficulty: QuizDifficulty }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-wide ${difficultyTextColor[difficulty]}`}>
      {difficultyLabel[difficulty]}
    </span>
  );
}

export function difficultyEdgeClass(difficulty: QuizDifficulty): string {
  return difficultyEdge[difficulty];
}
