'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { FlashcardRunnerCard } from './FlashcardRunner';
import { isTypedAnswerCorrect, pickDistractors, shuffled } from './flashcardUtils';

interface Props {
  cards: FlashcardRunnerCard[];
  title?: string;
  onDone?: () => void;
  onComplete?: () => void;
}

/**
 * Learn mode. Every card starts unlearned. A correct multiple-choice answer
 * moves it to "familiar"; a correct typed answer moves it to "mastered".
 * Wrong answers send the card back to the start and it comes around again.
 * Progress lives in component state only (nothing is saved anywhere).
 */
export function FlashcardLearn({ cards, title, onDone, onComplete }: Props) {
  const [level, setLevel] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<string[]>(() => shuffled(cards.map((c) => c.id)));
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const completed = useRef(false);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const currentId = queue[0];
  const card = currentId ? byId.get(currentId) : undefined;
  const cardLevel = currentId ? level[currentId] ?? 0 : 0;
  const canChoose = cards.length >= 3;
  const mode: 'choice' | 'typed' = cardLevel === 0 && canChoose ? 'choice' : 'typed';

  const mastered = cards.filter((c) => (level[c.id] ?? 0) >= 2).length;
  const done = mastered === cards.length;

  const options = useMemo(() => {
    if (!card || mode !== 'choice') return [];
    return shuffled([card, ...pickDistractors(cards, card, 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, mode]);

  useEffect(() => {
    if (done && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function settle(correct: boolean) {
    if (!card) return;
    setChecked(correct);
    if (correct) setRightCount((n) => n + 1);
    else setWrongCount((n) => n + 1);
  }

  function next(correct: boolean) {
    if (!card) return;
    const id = card.id;
    setLevel((prev) => ({ ...prev, [id]: correct ? Math.min(2, (prev[id] ?? 0) + (mode === 'choice' ? 1 : 2)) : 0 }));
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (correct && (level[id] ?? 0) + (mode === 'choice' ? 1 : 2) >= 2) return rest;
      // Reinsert a few cards later so it is not asked straight away again.
      const at = Math.min(rest.length, correct ? 4 : 2);
      return [...rest.slice(0, at), id, ...rest.slice(at)];
    });
    setPicked(null);
    setTyped('');
    setChecked(null);
  }

  function restart() {
    completed.current = false;
    setLevel({});
    setQueue(shuffled(cards.map((c) => c.id)));
    setPicked(null);
    setTyped('');
    setChecked(null);
    setWrongCount(0);
    setRightCount(0);
  }

  if (cards.length === 0) return <p className="py-12 text-center text-sm text-ink-400">No cards to study yet.</p>;

  if (done) {
    const total = rightCount + wrongCount;
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Learn complete</p>
          <p className="mt-4 font-display text-3xl font-semibold text-ink-800">All {cards.length} cards mastered</p>
          <p className="mt-2 text-sm text-ink-500">
            {rightCount} correct of {total} answers
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={restart}>Learn again</Button>
            {onDone && <Button onClick={onDone}>Done</Button>}
          </div>
        </Card>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>{mastered} of {cards.length} mastered</span>
        {title && <span className="font-mono text-xs uppercase tracking-widest text-pulse-600">{title}</span>}
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-ink-100">
        <div className="h-1 rounded-full bg-pulse-500 transition-all" style={{ width: `${(mastered / cards.length) * 100}%` }} />
      </div>

      <Card className="mt-6 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-400">
          {mode === 'choice' ? 'Choose the matching answer' : 'Type the answer'}
        </p>
        <p className="mt-3 whitespace-pre-line font-display text-xl font-medium text-ink-800">{card.front}</p>

        {mode === 'choice' ? (
          <div className="mt-5 space-y-2">
            {options.map((opt) => {
              const isCorrect = opt.id === card.id;
              const isPicked = picked === opt.id;
              let style = 'border-ink-100 text-ink-700 hover:border-pulse-400';
              if (checked !== null) {
                if (isCorrect) style = 'border-pulse-400 bg-pulse-50 text-pulse-700';
                else if (isPicked) style = 'border-critical-400 bg-critical-50 text-critical-500';
                else style = 'border-ink-100 text-ink-400';
              }
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={checked !== null}
                  onClick={() => {
                    setPicked(opt.id);
                    settle(isCorrect);
                  }}
                  className={`block w-full rounded-md border px-4 py-3 text-left text-sm ${style}`}
                >
                  {opt.back}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={checked !== null}
              rows={3}
              placeholder="Type your answer"
              className="w-full rounded-md border border-ink-100 bg-white px-4 py-2 text-sm text-ink-700 focus:border-pulse-400 focus:outline-none"
            />
            {checked === null && (
              <div className="mt-3 flex gap-2">
                <Button onClick={() => settle(isTypedAnswerCorrect(typed, card.back))} disabled={!typed.trim()}>
                  Check
                </Button>
                <Button variant="secondary" onClick={() => settle(false)}>
                  Show answer
                </Button>
              </div>
            )}
          </div>
        )}

        {checked !== null && (
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className={`text-sm font-semibold ${checked ? 'text-pulse-600' : 'text-critical-500'}`}>
              {checked ? 'Correct' : 'Not quite'}
            </p>
            {!checked && (
              <p className="mt-1 whitespace-pre-line text-sm text-ink-600">
                <span className="font-semibold">Answer:</span> {card.back}
              </p>
            )}
            {card.explanation && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-500">{card.explanation}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => next(checked)}>Continue</Button>
              {!checked && mode === 'typed' && (
                <Button variant="secondary" onClick={() => next(true)}>
                  I was right
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
