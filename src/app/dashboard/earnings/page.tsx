'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';

interface EarningsHistoryItem {
  id: string;
  quizTitle: string;
  creatorEarningKobo: number;
  createdAt: string;
}

interface PayoutRequestItem {
  id: string;
  amountKobo: number;
  method: 'flutterwave' | 'manual' | null;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  createdAt: string;
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

const STATUS_LABEL: Record<PayoutRequestItem['status'], string> = {
  pending: 'Pending review',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed, refunded to balance',
};

export default function EarningsPage() {
  const { user, loading } = useAuth();
  const [totalKobo, setTotalKobo] = useState(0);
  const [balanceKobo, setBalanceKobo] = useState(0);
  const [history, setHistory] = useState<EarningsHistoryItem[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestItem[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [payoutDetails, setPayoutDetails] = useState<{ hasPayoutDetails: boolean } | null>(null);

  async function loadPayoutRequests() {
    const res = await fetch('/api/creator/payout-requests');
    const data = await res.json();
    setBalanceKobo(data.balanceKobo ?? 0);
    setPayoutRequests(data.requests ?? []);
  }

  useEffect(() => {
    if (!user) return;
    fetch('/api/creator/earnings')
      .then((res) => res.json())
      .then((data) => {
        setTotalKobo(data.totalKobo ?? 0);
        setHistory(data.history ?? []);
      });
    fetch('/api/creator/payout-details')
      .then((res) => res.json())
      .then((data) => setPayoutDetails(data));
    loadPayoutRequests();
  }, [user]);

  async function requestPayout() {
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await fetch('/api/creator/payout-requests', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? 'Failed to request payout');
        return;
      }
      await loadPayoutRequests();
    } finally {
      setRequesting(false);
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

  const hasPayoutDetails = !!payoutDetails?.hasPayoutDetails;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Earnings</h1>
      <p className="mt-2 text-sm text-ink-400">
        Cliniolab collects every sale directly. Your share is credited to your balance below.
        request a payout any time and admin will send it to your bank.
      </p>

      <Card className="mt-6 p-8 text-center">
        <p className="font-mono text-4xl font-semibold text-pulse-600">{formatNaira(balanceKobo)}</p>
        <p className="mt-1 text-xs text-ink-400">Withdrawable balance</p>
        <p className="mt-4 text-sm text-ink-500">{formatNaira(totalKobo)} earned all-time</p>

        {!hasPayoutDetails ? (
          <Card className="mt-6 p-4">
            <p className="text-sm text-ink-700">Add your bank details before requesting a payout.</p>
            <Link href="/dashboard/payout-setup" className="mt-2 inline-block text-sm font-medium text-pulse-600">
              Set up payout details →
            </Link>
          </Card>
        ) : (
          <>
            <Button className="mt-6" onClick={requestPayout} disabled={requesting || balanceKobo <= 0}>
              {requesting ? 'Requesting…' : 'Request payout'}
            </Button>
            {requestError && <p className="mt-2 text-sm text-critical-500">{requestError}</p>}
          </>
        )}
      </Card>

      {payoutRequests.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-semibold text-ink-800">Payout requests</h2>
          <div className="mt-4 space-y-2">
            {payoutRequests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-ink-800">{formatNaira(r.amountKobo)}</p>
                  <p className="text-xs text-ink-400">
                    Requested {new Date(r.createdAt).toLocaleDateString()}
                    {r.method && ` · ${r.method === 'flutterwave' ? 'Flutterwave transfer' : 'Manual'}`}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    r.status === 'paid'
                      ? 'text-pulse-600'
                      : r.status === 'failed'
                        ? 'text-critical-500'
                        : 'text-ink-400'
                  }`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold text-ink-800">Sales history</h2>
      <div className="mt-4 space-y-2">
        {history.map((h) => (
          <Card key={h.id} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-ink-800">{h.quizTitle}</p>
              <p className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="font-mono text-sm font-semibold text-pulse-600">
              {formatNaira(h.creatorEarningKobo)}
            </span>
          </Card>
        ))}
        {history.length === 0 && <p className="text-sm text-ink-400">No sales yet.</p>}
      </div>
    </div>
  );
}
