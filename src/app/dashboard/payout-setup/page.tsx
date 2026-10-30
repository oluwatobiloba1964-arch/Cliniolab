'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function PayoutSetupPage() {
  const { user, loading } = useAuth();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [existing, setExisting] = useState<{
    hasPayoutDetails: boolean;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/creator/payout-details')
      .then((res) => res.json())
      .then(setExisting);
  }, []);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError('Enter your bank name, account number, and account name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/creator/payout-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save payout details');
        return;
      }
      setSuccess('Payout details saved.');
      setExisting({
        hasPayoutDetails: true,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Payout setup</h1>
      <p className="mt-2 text-ink-500">
        Add your bank details so you can request a payout once you&apos;ve earned from paid
        quizzes. Cliniolab collects each sale directly, so your share is credited to your balance,
        and you withdraw it by requesting a payout from your Earnings page.
      </p>

      {existing?.hasPayoutDetails && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-medium text-ink-800">Current payout account</p>
          <p className="mt-1 text-sm text-ink-600">
            {existing.bankName} · {existing.accountNumber} · {existing.accountName}
          </p>
          <p className="mt-2 text-xs text-ink-400">Submitting the form below replaces these details.</p>
        </Card>
      )}

      <Card className="mt-6 space-y-3 p-5">
        <input
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="Bank name"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="10-digit account number"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Account name"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <p className="text-xs text-ink-400">
          Double-check these details. They aren&apos;t automatically verified, and payouts are sent
          to exactly what you enter here.
        </p>
        {error && <p className="text-sm text-critical-500">{error}</p>}
        {success && <p className="text-sm text-pulse-600">{success}</p>}
        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save payout details'}
        </Button>
      </Card>
    </div>
  );
}
