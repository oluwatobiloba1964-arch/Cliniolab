'use client';

import Link from 'next/link';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';
import { SmartRevisionQueue } from '@/components/study/SmartRevisionQueue';

export default function SmartRevisionPage() {
  const { flags } = usePublicConfig();
  if (!flags.smartRevisionQueue) return <div className="mx-auto max-w-2xl px-6 py-20"><h1 className="text-2xl font-semibold text-ink-900">Smart Revision Queue is currently disabled</h1><Link className="mt-4 inline-block text-pulse-600" href="/dashboard">Return to dashboard</Link></div>;
  return <SmartRevisionQueue />;
}
