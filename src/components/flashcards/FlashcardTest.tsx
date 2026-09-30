'use client';

import { useMemo, useRef, useState } from 'react';
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

type QType = 'choice' | 'truefalse' | 'written';

interface TestQuestion {
  id: string;
  type: QType;
  card: FlashcardRunnerCard;
  /** choice: option cards (includes the right one). truefalse: the statement shown. */
  options?: FlashcardRunnerCard[];
  statement?: string;
  statementIsTrue?: boolean;
}

/**
 * Test mode. Pick how many questions and which types, answer them all, then
 * see a scored review. Nothing is saved; the score exists only on screen.
 */
export function FlashcardTest({ cards, title, onDone, onComplete }: Props) {
  const maxQuestions = cards.length;
  const [count, setCount] = useState(Math.min(10, maxQuestions));
  const [types, setTypes] = useState<Record<QType, boolean>>({ choice: true, truefalse: true, written: true });
  const [questions, setQuestions] = useState<TestQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const completed = useRef(false);

  const canChoice = cards.length >= 3;
  const canTF = cards.length >= 2;
  const enabledTypes = useMemo(() => {
    const list: QType[] = [];
    if (types.choice && canChoice) list.push('choice');
    if (types.truefalse && canTF) list.push('truefalse');
    if (types.written) list.push('written');
    return list;
  }, [types, canChoice, canTF]);

  function start() {
    if (enabledTypes.length === 0) return;
    const picked = shuffled(cards).slice(0, Math.max(1, Math.min(count, maxQuestions)));
    const built: TestQuestion[] = picked.map((card, i) => {
      const type = enabledTypes[i % enabledTypes.length];
      const id = `q${i}-${card.id}`;
      if (type === 'choice') {
        return { id, type, card, options: shuffled([card, ...pickDistractors(cards, card, 3)]) };
      }
      if (type === 'truefalse') {
        const useTrue = Math.random() < 0.5;
        const other = pickDistractors(cards, card, 1)[0];
        const isTrue = useTrue || !other;
        return {
          id,
          type,
          card,
          statement: isTrue ? card.back : other.back,
          statementIsTrue: isTrue,
        };
      }
      return { id, type, card };
    });
    setQuestions(shuffled(built));
    setAnswers({});
    setSubmitted(false);
    completed.current = false;
  }

  function isCorrect(q: TestQuestion): boolean {
    const a = answers[q.id];
    if (a === undefined || a === '') return false;
    if (q.type === 'choice') return a === q.card.id;
    if (q.type === 'truefalse') return (a === 'true') === !!q.statementIsTrue;
    return isTypedAnswerCorrect(a, q.card.back);
  }

  function submit() {
    setSubmitted(true);
    if (!completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }

  if (cards.length < 2) {
    return <p className="py-12 text-center text-sm text-ink-400">Test mode needs at least 2 cards.</p>;
  }

  if (!questions) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <Card className="p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">{title ?? 'Test'}</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink-800">Set up your test</h2>
          <label className="mt-5 block text-sm font-medium text-ink-700">
            Questions: {Math.min(count, maxQuestions)} of {maxQuestions}
            <input
              type="range"
              min={1}
              max={maxQuestions}
              value={Math.min(count, maxQuestions)}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <div className="mt-4 space-y-2 text-sm text-ink-700">
            {(
              [
                ['choice', 'Multiple choice', canChoice],
                ['truefalse', 'True / False', canTF],
                ['written', 'Written answer', true],
              ] as [QType, string, boolean][]
            ).map(([key, label, available]) => (
              <label key={key} className={`flex items-center gap-2 ${available ? '' : 'opacity-40'}`}>
                <input
                  type="checkbox"
                  disabled={!available}
                  checked={types[key] && available}
                  onChange={(e) => setTypes((t) => ({ ...t, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button onClick={start} disabled={enabledTypes.length === 0}>Start test</Button>
            {onDone && <Button variant="secondary" onClick={onDone}>Cancel</Button>}
          </div>
        </Card>
      </div>
    );
  }

  const score = questions.filter(isCorrect).length;
  const answeredCount = questions.filter((q) => (answers[q.id] ?? '') !== '').length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {submitted && (
        <Card className="p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Test complete</p>
          <p className="mt-3 font-display text-3xl font-semibold text-ink-800">
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm text-ink-500">{Math.round((score / questions.length) * 100)}%</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => setQuestions(null)}>New test</Button>
            {onDone && <Button onClick={onDone}>Done</Button>}
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {questions.map((q, i) => {
          const ok = submitted && isCorrect(q);
          const bad = submitted && !ok;
          return (
            <Card key={q.id} className={`p-5 ${ok ? 'border-pulse-400' : bad ? 'border-critical-400' : ''}`}>
              <p className="text-xs text-ink-400">
                {i + 1}. {q.type === 'choice' ? 'Multiple choice' : q.type === 'truefalse' ? 'True or false' : 'Written'}
              </p>
              <p className="mt-2 whitespace-pre-line font-display text-lg font-medium text-ink-800">{q.card.front}</p>

              {q.type === 'truefalse' && (
                <p className="mt-2 whitespace-pre-line rounded-md bg-ink-50 p-3 text-sm text-ink-700">{q.statement}</p>
              )}

              {q.type === 'choice' && (
                <div className="mt-3 space-y-2">
                  {q.options!.map((opt) => {
                    const picked = answers[q.id] === opt.id;
                    let style = picked ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-700';
                    if (submitted) {
                      if (opt.id === q.card.id) style = 'border-pulse-400 bg-pulse-50 text-pulse-700';
                      else if (picked) style = 'border-critical-400 bg-critical-50 text-critical-500';
                      else style = 'border-ink-100 text-ink-400';
                    }
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                        className={`block w-full rounded-md border px-4 py-2 text-left text-sm ${style}`}
                      >
                        {opt.back}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'truefalse' && (
                <div className="mt-3 flex gap-2">
                  {(['true', 'false'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className={`rounded-md border px-5 py-2 text-sm ${answers[q.id] === v ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-700'}`}
                    >
                      {v === 'true' ? 'True' : 'False'}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'written' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  disabled={submitted}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={2}
                  placeholder="Type your answer"
                  className="mt-3 w-full rounded-md border border-ink-100 bg-white px-4 py-2 text-sm text-ink-700 focus:border-pulse-400 focus:outline-none"
                />
              )}

              {submitted && (
                <div className="mt-3 border-t border-ink-100 pt-3 text-sm">
                  <p className={ok ? 'font-semibold text-pulse-600' : 'font-semibold text-critical-500'}>
                    {ok ? 'Correct' : 'Incorrect'}
                  </p>
                  {!ok && (
                    <p className="mt-1 whitespace-pre-line text-ink-600">
                      <span className="font-semibold">Answer:</span> {q.card.back}
                    </p>
                  )}
                  {q.card.explanation && (
                    <p className="mt-1 whitespace-pre-line text-ink-500">{q.card.explanation}</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!submitted && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-md border border-ink-100 bg-white p-3 shadow-sm">
          <span className="text-sm text-ink-500">{answeredCount} of {questions.length} answered</span>
          <Button onClick={submit}>Submit test</Button>
        </div>
      )}
    </div>
  );
}
