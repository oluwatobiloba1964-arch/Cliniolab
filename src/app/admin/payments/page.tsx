'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';

interface PendingPayoutRequest {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  amountKobo: number;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [percent, setPercent] = useState(15);
  const [paidQuizzesEnabled, setPaidQuizzesEnabled] = useState(true);
  const [resourceMode, setResourceMode] = useState<'manual' | 'flutterwave'>('manual');
  const [saved, setSaved] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PendingPayoutRequest[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [fwSecretKey, setFwSecretKey] = useState('');
  const [fwWebhookHash, setFwWebhookHash] = useState('');
  const [fwClearSecret, setFwClearSecret] = useState(false);
  const [fwClearWebhook, setFwClearWebhook] = useState(false);
  const [fwStatus, setFwStatus] = useState<{
    secretKeyConfigured: boolean;
    secretKeySource: 'admin' | 'environment' | 'missing';
    webhookHashConfigured: boolean;
    webhookHashSource: 'admin' | 'environment' | 'missing';
  } | null>(null);
  const [fwSaving, setFwSaving] = useState(false);
  const [fwMessage, setFwMessage] = useState<string | null>(null);

  async function loadPayoutRequests() {
    const res = await fetch('/api/admin/payout-requests');
    const data = await res.json();
    setPayoutRequests(data.requests ?? []);
  }

  useEffect(() => {
    fetch('/api/admin/platform-fee')
      .then((res) => res.json())
      .then((data) => setPercent(data.platformFeePercent));
    fetch('/api/admin/flags')
      .then((res) => res.json())
      .then((data) => {
        const flag = data.flags?.find((f: { key: string }) => f.key === 'paid_quizzes');
        if (flag) setPaidQuizzesEnabled(flag.enabled);
      });
    fetch('/api/admin/resource-payment-mode')
      .then((res) => res.json())
      .then((data) => setResourceMode(data.mode));
    loadPayoutRequests();
    fetch('/api/admin/flutterwave-settings')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setFwStatus(data); });
  }, []);

  async function saveFlutterwaveSettings() {
    setFwSaving(true);
    setFwMessage(null);
    try {
      const res = await fetch('/api/admin/flutterwave-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(fwSecretKey.trim() ? { secretKey: fwSecretKey.trim() } : {}),
          ...(fwWebhookHash.trim() ? { webhookHash: fwWebhookHash.trim() } : {}),
          clearSecretKey: fwClearSecret,
          clearWebhookHash: fwClearWebhook,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFwMessage(data.error ?? 'Could not save Flutterwave settings.');
        return;
      }
      setFwStatus(data);
      setFwSecretKey('');
      setFwWebhookHash('');
      setFwClearSecret(false);
      setFwClearWebhook(false);
      setFwMessage('Flutterwave settings saved. Secret values are not displayed after saving.');
    } catch {
      setFwMessage('Network error while saving Flutterwave settings.');
    } finally {
      setFwSaving(false);
    }
  }

  async function savePercent() {
    setSaved(false);
    const res = await fetch('/api/admin/platform-fee', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformFeePercent: percent }),
    });
    if (res.ok) setSaved(true);
  }

  async function togglePaidQuizzes(enabled: boolean) {
    setPaidQuizzesEnabled(enabled);
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'paid_quizzes', enabled }),
    });
  }

  async function changeResourceMode(mode: 'manual' | 'flutterwave') {
    setResourceMode(mode);
    await fetch('/api/admin/resource-payment-mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  }

  async function actionPayout(requestId: string, method: 'flutterwave' | 'manual') {
    setActioningId(requestId);
    setPayoutError(null);
    try {
      const res = await fetch(`/api/admin/payout-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data.error ?? 'Failed to action payout');
        return;
      }
      await loadPayoutRequests();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Payments</h1>
      <p className="mt-1 text-sm text-ink-500">
        Cliniolab collects all payments directly via Flutterwave, then creators withdraw their
        earnings on request. You decide how each payout and resource sale is handled below.
      </p>

      {/* Flutterwave API credentials */}
      <Card className="mt-6 space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-800">Flutterwave API & Webhook</h2>
          <p className="mt-1 text-sm text-ink-500">
            Admin-managed credentials override environment variables. If no admin credential is saved,
            the app falls back to FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_HASH.
            Saved secrets are never sent back to this page.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-ink-100 p-3 text-sm">
            <p className="font-medium text-ink-800">API secret key</p>
            <p className={fwStatus?.secretKeyConfigured ? 'mt-1 text-green-700' : 'mt-1 text-critical-500'}>
              {fwStatus?.secretKeyConfigured ? `Configured (${fwStatus.secretKeySource === 'admin' ? 'Admin setting' : 'Environment fallback'})` : 'Not configured'}
            </p>
          </div>
          <div className="rounded-md border border-ink-100 p-3 text-sm">
            <p className="font-medium text-ink-800">Webhook hash</p>
            <p className={fwStatus?.webhookHashConfigured ? 'mt-1 text-green-700' : 'mt-1 text-critical-500'}>
              {fwStatus?.webhookHashConfigured ? `Configured (${fwStatus.webhookHashSource === 'admin' ? 'Admin setting' : 'Environment fallback'})` : 'Not configured'}
            </p>
          </div>
        </div>
        <label className="block text-sm text-ink-700">
          Flutterwave Secret Key
          <input
            type="password"
            autoComplete="new-password"
            value={fwSecretKey}
            onChange={(e) => { setFwSecretKey(e.target.value); setFwClearSecret(false); }}
            placeholder="Enter a new secret key to replace the current one"
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-ink-700">
          Flutterwave Webhook Hash
          <input
            type="password"
            autoComplete="new-password"
            value={fwWebhookHash}
            onChange={(e) => { setFwWebhookHash(e.target.value); setFwClearWebhook(false); }}
            placeholder="Enter the exact webhook secret hash from Flutterwave"
            className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2"
          />
        </label>
        <div className="space-y-2 text-sm text-ink-600">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={fwClearSecret} onChange={(e) => setFwClearSecret(e.target.checked)} />
            <span>Remove admin-saved API key and use the environment fallback, if configured.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={fwClearWebhook} onChange={(e) => setFwClearWebhook(e.target.checked)} />
            <span>Remove admin-saved webhook hash and use the environment fallback, if configured.</span>
          </label>
        </div>
        {fwMessage && <p role="status" className="text-sm text-pulse-600">{fwMessage}</p>}
        <Button onClick={saveFlutterwaveSettings} disabled={fwSaving}>
          {fwSaving ? 'Saving credentials…' : 'Save Flutterwave settings'}
        </Button>
        <p className="text-xs text-ink-400">
          Set the webhook URL in your Flutterwave dashboard to your full site URL ending in <code>/api/webhooks/flutterwave</code>.
          Configure the charge-completed and transfer-completed events. The webhook hash must match exactly.
        </p>
      </Card>

      {/* Creator payout queue */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink-800">
          Pending creator payouts {payoutRequests.length > 0 && `(${payoutRequests.length})`}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Every payout request lands here. Pick Flutterwave to send the transfer automatically, or
          Manual if you&apos;ve already paid the creator yourself outside the system.
        </p>
        {payoutError && <p className="mt-2 text-sm text-critical-500">{payoutError}</p>}
        <div className="mt-4 space-y-3">
          {payoutRequests.length === 0 && (
            <Card className="p-5 text-sm text-ink-400">No pending payout requests.</Card>
          )}
          {payoutRequests.map((req) => (
            <Card key={req.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-ink-800">{req.creatorName}</p>
                <p className="text-xs text-ink-400">{req.creatorEmail}</p>
                <p className="mt-1 text-sm font-semibold text-pulse-600">
                  ₦{(req.amountKobo / 100).toLocaleString('en-NG')}
                </p>
                <p className="text-xs text-ink-400">
                  Requested {new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={actioningId === req.id}
                  onClick={() => actionPayout(req.id, 'flutterwave')}
                >
                  {actioningId === req.id ? 'Processing…' : 'Pay via Flutterwave'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actioningId === req.id}
                  onClick={() => actionPayout(req.id, 'manual')}
                >
                  Mark paid manually
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Resource payment mode */}
      <Card className="mt-8 space-y-3 p-5">
        <label className="text-sm font-medium text-ink-700">Resource purchase payment mode</label>
        <p className="text-xs text-ink-400">
          Applies platform-wide to every paid resource (books, past-question packs, etc). Since
          admin uploads resources directly, there&apos;s no creator split here — this only
          controls how the buyer pays.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => changeResourceMode('manual')}
            className={`rounded-md border px-4 py-2 text-sm ${resourceMode === 'manual' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
          >
            Manual (buyer transfers, uploads proof, you confirm)
          </button>
          <button
            type="button"
            onClick={() => changeResourceMode('flutterwave')}
            className={`rounded-md border px-4 py-2 text-sm ${resourceMode === 'flutterwave' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
          >
            Flutterwave (automatic checkout, instant unlock)
          </button>
        </div>
      </Card>

      {/* Paid quizzes toggle + platform fee */}
      <Card className="mt-4 space-y-4 p-5">
        <Toggle
          checked={paidQuizzesEnabled}
          onChange={togglePaidQuizzes}
          label="Allow users to create and sell paid quizzes"
        />
        <p className="text-xs text-ink-400">
          When off, the paid-quiz option disappears from quiz creation and existing paid quizzes
          can&apos;t be purchased until turned back on.
        </p>
      </Card>

      <Card className="mt-4 space-y-3 p-5">
        <label className="text-sm font-medium text-ink-700">
          Platform commission on paid quizzes (%)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <p className="text-xs text-ink-400">
          Creators keep {100 - percent}% of every sale, credited to their withdrawable balance —
          Cliniolab collects the full payment via Flutterwave, and creators withdraw by requesting
          a payout above. Applies to new sales immediately after saving — already completed sales
          aren&apos;t recalculated.
        </p>
        <Button size="sm" onClick={savePercent}>Save</Button>
        {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
      </Card>
    </div>
  );
}
