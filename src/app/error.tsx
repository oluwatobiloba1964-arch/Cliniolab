'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function classifyError(error: Error): {
  title: string;
  detail: string;
  primaryAction: { label: string; href?: string; onClick?: () => void };
} {
  const message = error.message || '';
  // Payment-related errors come from the Flutterwave webhook mismatch or
  // a client-side abort during payment verification.
  if (/payment|flutterwave|transaction/i.test(message)) {
    return {
      title: 'Payment problem',
      detail: 'We could not confirm your payment. Your dashboard keeps the latest status, and any access you paid for will appear there.',
      primaryAction: { label: 'Go to dashboard', href: '/dashboard' },
    };
  }
  // Network errors usually mean the user is offline or a fetch timed out.
  if (/network|fetch|timeout|failed to fetch|load failed/i.test(message)) {
    return {
      title: 'Connection problem',
      detail: 'This page could not be loaded. Check your connection and try again — your work on this device is safe.',
      primaryAction: { label: 'Try again', onClick: () => window.location.reload() },
    };
  }
  // 404 / "not found" surfaced through the error boundary.
  if (/not found|404/i.test(message)) {
    return {
      title: 'Page not found',
      detail: 'We could not find what you were looking for. Browse the latest quizzes or head home.',
      primaryAction: { label: 'Browse quizzes', href: '/quizzes' },
    };
  }
  return {
    title: 'Something went wrong',
    detail: 'An unexpected error occurred while loading this page. You can try again, or head back home.',
    primaryAction: { label: 'Try again', onClick: () => window.location.reload() },
  };
}

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

  const classification = classifyError(error);
  const primary = classification.primaryAction;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Card className="w-full border-critical-200 bg-critical-50 p-8">
        <p className="font-display text-xl font-semibold text-ink-800">{classification.title}</p>
        <p className="mt-2 text-sm text-ink-500">{classification.detail}</p>
        {error.digest && (
          <p className="mt-3 text-xs text-ink-400">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/">
            <Button variant="secondary">Go home</Button>
          </Link>
          {primary.href ? (
            <Link href={primary.href}>
              <Button>{primary.label}</Button>
            </Link>
          ) : (
            <Button
              onClick={() => {
                if (primary.onClick) {
                  primary.onClick();
                } else {
                  reset();
                }
              }}
            >
              {primary.label}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
