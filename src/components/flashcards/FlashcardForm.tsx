'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { clearPublicFetchCache } from '@/lib/client/publicFetch';
import type {
  Category,
  Flashcard,
  FlashcardCardInput,
  FlashcardInput,
  FlashcardSet,
  QuizVisibility,
  Subcategory,
} from '@/types';

function emptyCard(): FlashcardCardInput {
  return { front: '', back: '', explanation: '' };
}

function toCardInput(c: Flashcard): FlashcardCardInput {
  return { id: c.id, front: c.front, back: c.back, explanation: c.explanation ?? undefined };
}

interface FlashcardFormProps {
  initialSet?: FlashcardSet;
  initialCards?: Flashcard[];
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: FlashcardInput) => Promise<{ error?: string } | void>;
}

export function FlashcardForm({
  initialSet,
  initialCards,
  submitLabel,
  submittingLabel,
  onSubmit,
}: FlashcardFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [title, setTitle] = useState(initialSet?.title ?? '');
  const [description, setDescription] = useState(initialSet?.description ?? '');
  const [subcategoryId, setSubcategoryId] = useState(initialSet?.subcategoryId ?? '');
  const [visibility, setVisibility] = useState<QuizVisibility>(initialSet?.visibility ?? 'public');
  const [pricing, setPricing] = useState<'free' | 'paid'>(initialSet?.pricing ?? 'free');
  const [shuffleCards, setShuffleCards] = useState(initialSet?.shuffleCards ?? false);
  const [priceNaira, setPriceNaira] = useState(
    initialSet?.priceKobo ? Math.round(initialSet.priceKobo / 100) : 0
  );
  const [cards, setCards] = useState<FlashcardCardInput[]>(
    initialCards && initialCards.length > 0 ? initialCards.map(toCardInput) : [emptyCard()]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      });
  }, []);

  function updateCard(index: number, patch: Partial<FlashcardCardInput>) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCard() {
    setCards((prev) => [...prev, emptyCard()]);
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !subcategoryId || cards.length === 0) {
      setError('Title, category, and at least one card are required.');
      return;
    }
    if (cards.some((c) => !c.front.trim() || !c.back.trim())) {
      setError('Every card needs a front and a back.');
      return;
    }
    if (pricing === 'paid' && priceNaira <= 0) {
      setError('Set a price greater than ₦0 for a paid flashcard set.');
      return;
    }

    const input: FlashcardInput = {
      subcategoryId,
      title: title.trim(),
      description: description.trim() || undefined,
      visibility,
      pricing,
      priceKobo: pricing === 'paid' ? Math.round(priceNaira * 100) : undefined,
      shuffleCards,
      cards,
    };

    setSubmitting(true);
    try {
      const result = await onSubmit(input);
      if (result?.error) setError(result.error);
      else clearPublicFetchCache('/api/flashcards');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-paper/95 px-4 py-3 backdrop-blur">
        {error && <p className="text-sm text-critical-500">{error}</p>}
        <div className="ml-auto">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <label className="text-sm font-medium text-ink-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            rows={2}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">Subcategory</label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          >
            <option value="">Select a subcategory</option>
            {categories.map((cat) => (
              <optgroup key={cat.id} label={cat.name}>
                {subcategories.filter((s) => s.categoryId === cat.id).map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink-700">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as QuizVisibility)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            >
              <option value="public">Public: listed and shareable</option>
              <option value="private">Private: link-only</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Pricing</label>
            <select
              value={pricing}
              onChange={(e) => setPricing(e.target.value as 'free' | 'paid')}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {pricing === 'paid' && (
          <div>
            <label className="text-sm font-medium text-ink-700">Price (₦)</label>
            <input
              type="number"
              min={1}
              value={priceNaira}
              onChange={(e) => setPriceNaira(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
        )}

        <Toggle checked={shuffleCards} onChange={setShuffleCards} label="Shuffle card order" />
      </Card>

      <div className="mt-6 space-y-4">
        {cards.map((card, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink-700">Card {i + 1}</p>
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCard(i)}
                  className="text-xs font-medium text-critical-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-500">Front</label>
                <textarea
                  value={card.front}
                  onChange={(e) => updateCard(i, { front: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                  placeholder="Question / term / prompt"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500">Back</label>
                <textarea
                  value={card.back}
                  onChange={(e) => updateCard(i, { back: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                  placeholder="Answer / definition"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-ink-500">Explanation (optional)</label>
              <textarea
                value={card.explanation ?? ''}
                onChange={(e) => updateCard(i, { explanation: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-ink-100 px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                placeholder="Extra context shown after flipping the card"
              />
            </div>
          </Card>
        ))}

        <Button variant="secondary" onClick={addCard}>
          + Add another card
        </Button>
      </div>
    </div>
  );
}
