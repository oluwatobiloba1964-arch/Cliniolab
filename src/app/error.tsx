'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Card className="w-full border-critical-200 bg-critical-50 p-8">
        <p className="font-display text-xl font-semibold text-ink-800">Something went wrong</p>
        <p className="mt-2 text-sm text-ink-500">
          An unexpected error occurred while loading this page. You can try again, or head back home.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-ink-400">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </Card>
    </div>
  );
}
