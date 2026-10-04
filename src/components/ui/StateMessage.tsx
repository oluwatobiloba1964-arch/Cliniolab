import React from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-500" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-pulse rounded-full bg-pulse-200" aria-hidden="true" />
      <span>{label}...</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-8 text-center">
      <p className="font-display text-lg font-semibold text-ink-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'Please try again.' }: { title?: string; description?: string }) {
  return (
    <div className="rounded-xl border border-critical-200 bg-critical-50 p-5 text-sm text-critical-700" role="alert">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}
