// File: src/components/home/DailyChallenge.tsx
// Home page widget for the daily clinical challenge. Pure client-side:
// no fetch, no API call, no database read. Reads the deterministic daily
// question bank and tracks a streak counter in localStorage.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, CheckCircle2, Flame, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  getTodaysDailyChallenge,
  hasPlayedToday,
  markDailyChallengePlayed,
  readStreak,
  type DailyChallengeQuestion,
} from '@/lib/services/dailyChallengeService';

type Phase = 'intro' | 'questions' | 'results';

export function DailyChallenge() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [playedToday, setPlayedToday] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setQuestions(getTodaysDailyChallenge());
    const played = hasPlayedToday();
    setPlayedToday(played);
    setStreak(readStreak().currentStreak);
    setMounted(true);
  }, []);

  const score = useMemo(() => {
    if (!submitted) return 0;
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    return correct;
  }, [submitted, answers, questions]);

  function startChallenge() {
    setPhase('questions');
    setSubmitted(false);
    setAnswers({});
  }

  function submit() {
    setSubmitted(true);
    setPhase('results');
    const newDay = markDailyChallengePlayed();
    if (newDay) setStreak(readStreak().currentStreak);
    setPlayedToday(true);
  }

  if (!mounted) {
    // Avoid SSR/CSR mismatch — the deterministic bank is fine, but the
    // streak count comes from localStorage and would differ on first paint.
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Daily Clinical Challenge</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">12 clinical scenarios, every day</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
                A short, exam-style set of 12 clinical scenarios that rotates every day. Same set for everyone on the same day, so you can compare notes with classmates.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600" aria-hidden="true">
              <Flame className="h-3.5 w-3.5 text-pulse-600" />
              {streak}-day streak
            </div>
          </div>

          {phase === 'intro' && (
            <div className="rounded-2xl border border-pulse-100 bg-gradient-to-br from-pulse-50/80 to-white p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pulse-600 text-white">
                  <Brain className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-ink-900">
                    {playedToday ? "Today's challenge is open" : "Today's challenge is ready"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-500">
                    {playedToday
                      ? "You have already started today's set. You can run it again to test yourself, but your streak is already counted."
                      : "Start a fresh 12-question set. Complete it to keep your daily streak alive."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startChallenge}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
                    >
                      Start challenge
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <Link
                      href="/mnemonics"
                      className="inline-flex min-h-10 items-center rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-pulse-300 hover:text-pulse-700"
                    >
                      Browse mnemonics
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === 'questions' && (
            <ol className="space-y-4">
              {questions.map((q, index) => (
                <li key={q.id} className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                    Question {index + 1} · {q.topic}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-6 text-ink-800">{q.prompt}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((option, optIndex) => {
                      const selected = answers[q.id] === optIndex;
                      return (
                        <button
                          key={optIndex}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIndex }))}
                          aria-pressed={selected}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                            selected
                              ? 'border-pulse-400 bg-pulse-50 text-ink-900 ring-1 ring-pulse-200'
                              : 'border-ink-100 bg-white text-ink-700 hover:border-pulse-200'
                          }`}
                        >
                          <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-ink-400">{String.fromCharCode(65 + optIndex)}</span>
                          <span className="min-w-0">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {phase === 'questions' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-400">{Object.keys(answers).length} of {questions.length} answered</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('intro')}
                  className="inline-flex min-h-10 items-center rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={Object.keys(answers).length < questions.length}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pulse-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  Submit
                </button>
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div className="rounded-2xl border border-pulse-100 bg-gradient-to-br from-pulse-50/80 to-white p-5 sm:p-6">
              <p className="font-display text-2xl font-semibold text-ink-900">
                {score} / {questions.length} correct
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {score === questions.length
                  ? 'Perfect run. You are clinical-grade today.'
                  : score >= Math.ceil(questions.length * 0.7)
                  ? 'Solid work. Tighten the few weak spots below.'
                  : 'Use the explanations below to revise before tomorrow.'}
              </p>
              <ol className="mt-4 space-y-3">
                {questions.map((q, index) => {
                  const userAns = answers[q.id];
                  const isCorrect = userAns === q.correctIndex;
                  return (
                    <li key={q.id} className="rounded-xl border border-ink-100 bg-white p-3 sm:p-4">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isCorrect ? 'bg-pulse-600 text-white' : 'bg-critical-100 text-critical-700'}`} aria-hidden="true">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-800">{q.prompt}</p>
                          <p className="mt-1 text-xs text-ink-500">
                            Correct answer: <span className="font-semibold text-pulse-700">{q.options[q.correctIndex]}</span>
                          </p>
                          {!isCorrect && typeof userAns === 'number' && (
                            <p className="text-xs text-ink-500">Your answer: <span className="font-semibold text-critical-700">{q.options[userAns]}</span></p>
                          )}
                          <p className="mt-1.5 text-xs leading-5 text-ink-500">{q.rationale}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startChallenge}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  Run again
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-10 items-center rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-pulse-300 hover:text-pulse-700"
                >
                  Continue to dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
