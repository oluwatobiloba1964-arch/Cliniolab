'use client';

/**
 * Lightweight success pulse for Study Mode when an answer is correct.
 * Pure CSS animation. No network or database access.
 */

interface CorrectPulseProps {
  active: boolean;
}

export function CorrectPulse({ active }: CorrectPulseProps) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
      aria-hidden="true"
    >
      <div className="correct-pulse-ring" />
      <div className="correct-pulse-burst" />
    </div>
  );
}
