'use client';

// src/components/resources/ResourceCard.tsx

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { ShareButton } from '@/components/quiz/ShareButton';
import type { Resource, ResourceAccessState } from '@/types';

const FALLBACK_COVERS: Record<Resource['kind'], string> = {
  book: '/resource-fallback-book.png',
  past_question_pack: '/resource-fallback-past-questions.png',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

export function ResourceCard({ resource }: { resource: Resource }) {
  const [state, setState] = useState<ResourceAccessState | null>(null);
  const [revealedPrice, setRevealedPrice] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [showProofForm, setShowProofForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAccessState() {
    const res = await fetch(`/api/resources/${resource.id}/access`);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    setState(data);
  }

  async function handlePrimaryClick() {
    setError(null);
    if (!state) {
      // First click on a paid resource reveals price + fetches real access state.
      if (resource.pricing === 'paid' && !revealedPrice) {
        setRevealedPrice(true);
      }
      await loadAccessState();
      return;
    }

    if (state.access === 'download') {
      window.open(`/api/resources/${resource.id}/download`, '_blank');
      return;
    }
    if (state.access === 'pay_to_unlock' || state.access === 'payment_rejected') {
      setShowProofForm(true);
    }
  }

  async function submitProof() {
    if (!proofUrl.trim()) {
      setError('Please paste a link to your payment receipt/screenshot.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/resources/${resource.id}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofImageUrl: proofUrl.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to submit proof');
        return;
      }
      setShowProofForm(false);
      await loadAccessState();
    } finally {
      setSubmitting(false);
    }
  }

  const isFree = resource.pricing === 'free';

  // Resources don't have their own page, so the share link points at the
  // listing with an anchor; ResourcesPage scrolls to the matching card
  // (via this same #resource-{id} id) when a shared link is opened.
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/resources#resource-${resource.id}` : '';

  return (
    <Card id={`resource-${resource.id}`} className="flex flex-col p-3 sm:p-4 scroll-mt-20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resource.coverImageUrl || FALLBACK_COVERS[resource.kind]}
        alt=""
        className="mb-3 h-28 w-full rounded-md object-cover sm:h-40"
      />

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
            {resource.kind === 'past_question_pack' ? 'Past Questions' : 'Book'}
          </span>
          {isFree && <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs text-pulse-600">Free</span>}
          {resource.categoryName && (
            <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">{resource.categoryName}</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <ShareButton url={shareUrl} title={resource.title} showWhatsApp={false} />
            <BookmarkButton kind="resource" targetId={resource.id} />
          </span>
        </div>
        <h3 className="mt-2 font-display text-sm font-semibold text-ink-800 sm:text-base">{resource.title}</h3>
        {resource.institutionName && (
          <p className="mt-0.5 text-xs text-ink-400">{resource.institutionName}</p>
        )}
        {resource.description && (
          <p className="mt-1 line-clamp-3 text-xs leading-snug text-ink-500">{resource.description}</p>
        )}

        {!isFree && revealedPrice && resource.priceKobo && (
          <p className="mt-2 font-mono text-sm font-semibold text-flag-600">
            {formatNaira(resource.priceKobo)}
          </p>
        )}
      </div>

      {showProofForm ? (
        <div className="mt-3 space-y-2">
          <input
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="Paste receipt/screenshot link"
            className="w-full rounded-md border border-ink-100 px-3 py-1.5 text-xs focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={submitProof} disabled={submitting} className="w-full">
            {submitting ? 'Submitting…' : 'Submit proof of payment'}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={handlePrimaryClick}
          disabled={state?.access === 'payment_pending'}
          className="mt-3 w-full"
        >
          {!state && isFree && 'Click to download'}
          {!state && !isFree && 'Pay to unlock'}
          {state?.access === 'download' && 'Click to download'}
          {state?.access === 'pay_to_unlock' && 'Pay to unlock'}
          {state?.access === 'payment_pending' && 'Payment pending review'}
          {state?.access === 'payment_rejected' && 'Payment rejected — resubmit'}
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-critical-500">{error}</p>}
    </Card>
  );
}
