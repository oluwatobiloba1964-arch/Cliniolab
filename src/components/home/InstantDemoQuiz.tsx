// src/components/home/InstantDemoQuiz.tsx
'use client';

/**
 * Feature #16 - Fully client-side 3-question demo quiz.
 *
 * Three sample clinical MCQs are bundled in this file. The visitor can
 * answer them right on the homepage WITHOUT an account, WITHOUT any
 * API call, and WITHOUT any database read. The goal is to let every
 * homepage visitor experience the QuizRunner UX within ~10 seconds of
 * arrival, which is the highest-conversion moment for a clinical exam
 * prep platform.
 *
 * No DB, no API. Pure JS bundle.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface DemoQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    prompt:
      'A 54-year-old patient presents with crushing substernal chest pain, diaphoresis, and nausea. ECG shows ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
    options: [
      'Left anterior descending artery',
      'Right coronary artery',
      'Left circumflex artery',
      'Obtuse marginal artery',
    ],
    correctIndex: 1,
    explanation:
      'ST elevation in leads II, III, and aVF indicates an inferior wall myocardial infarction, most commonly caused by occlusion of the right coronary artery (RCA). The LAD supplies the anterior wall (V1-V4), and the circumflex supplies the lateral wall (I, aVL, V5-V6).',
  },
  {
    prompt:
      'A nurse is preparing to administer digoxin to a patient with atrial fibrillation. The patient\'s apical pulse is 52 beats per minute. What is the most appropriate action?',
    options: [
      'Administer the dose and recheck pulse in 30 minutes',
      'Hold the dose and notify the prescriber',
      'Administer half the dose and document',
      'Administer the dose with a glass of orange juice',
    ],
    correctIndex: 1,
    explanation:
      'Digoxin should be held when the apical pulse is below 60 bpm in adults because the drug further slows AV conduction and may precipitate symptomatic bradycardia or heart block. Holding the dose and notifying the prescriber is the correct nursing action.',
  },
  {
    prompt:
      'Which of the following is the earliest sign of increased intracranial pressure (ICP) in an adult patient?',
    options: [
      'Widened pulse pressure',
      'Decreased level of consciousness',
      'Decerebrate posturing',
      'Cheyne-Stokes respirations',
    ],
    correctIndex: 1,
    explanation:
      'A decreased level of consciousness (or subtle changes in responsiveness) is typically the earliest sign of rising ICP. Late signs include Cushing\'s triad (widened pulse pressure, bradycardia, irregular respirations), posturing, and fixed pupils. Early recognition allows intervention before herniation.',
  },
];

const LETTERS = ['A', 'B', 'C', 'D'];

export function InstantDemoQuiz() {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);

  const question = DEMO_QUESTIONS[current];
  const isLast = current === DEMO_QUESTIONS.length - 1;
  const score = answers.reduce((acc, ans, i) => acc + (ans === DEMO_QUESTIONS[i].correctIndex ? 1 : 0), 0);

  function selectOption(idx: number) {
    if (revealed) return;
    setSelected(idx);
  }

  function reveal() {
    if (selected === null) return;
    setRevealed(true);
    setAnswers((prev) => [...prev, selected]);
  }

  function next() {
    setCurrent((c) => Math.min(DEMO_QUESTIONS.length - 1, c + 1));
    setSelected(null);
    setRevealed(false);
  }

  function restart() {
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setAnswers([]);
  }

  const finished = isLast && revealed;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pulse-600">Try it instantly</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
          3 quick clinical questions, no sign-up needed
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          See exactly what Cliniolab quizzes feel like. Your answers stay in this browser tab.
        </p>
      </div>

      <Card className="mt-6 p-5 sm:p-7">
        {!finished ? (
          <>
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-400">
                Question {current + 1} of {DEMO_QUESTIONS.length}
              </span>
              <span className="font-mono text-ink-400">
                {Math.round(((current + (revealed ? 1 : 0)) / DEMO_QUESTIONS.length) * 100)}%
              </span>
            </div>
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full bg-pulse-500 transition-all duration-300"
                style={{ width: `${((current + (revealed ? 1 : 0)) / DEMO_QUESTIONS.length) * 100}%` }}
              />
            </div>

            <p className="text-base font-medium leading-7 text-ink-900 sm:text-lg">{question.prompt}</p>

            <ul className="mt-5 space-y-2">
              {question.options.map((opt, idx) => {
                const isSelected = selected === idx;
                const isCorrect = idx === question.correctIndex;
                let cls = 'border-ink-200 bg-white hover:border-pulse-300';
                if (revealed) {
                  if (isCorrect) cls = 'border-pulse-500 bg-pulse-50';
                  else if (isSelected) cls = 'border-critical-400 bg-critical-50';
                  else cls = 'border-ink-100 bg-white opacity-70';
                } else if (isSelected) {
                  cls = 'border-pulse-500 bg-pulse-50';
                }
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => selectOption(idx)}
                      disabled={revealed}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${cls}`}
                    >
                      <span
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                          isSelected || (revealed && isCorrect)
                            ? 'bg-pulse-500 text-white'
                            : revealed && isSelected
                              ? 'bg-critical-400 text-white'
                              : 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {LETTERS[idx]}
                      </span>
                      <span className="text-sm text-ink-800">{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {revealed && (
              <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">
                  {selected === question.correctIndex ? 'Correct!' : 'Not quite'}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-700">{question.explanation}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              {!revealed ? (
                <Button onClick={reveal} disabled={selected === null}>
                  Check answer
                </Button>
              ) : (
                !isLast && (
                  <Button onClick={next} variant="secondary">
                    Next question →
                  </Button>
                )
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">Done!</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink-900">
              {score} / {DEMO_QUESTIONS.length}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              You scored {Math.round((score / DEMO_QUESTIONS.length) * 100)}% on this sample set. Sign up for the full platform to access hundreds more, track your progress, and join the leaderboard.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button onClick={restart} variant="ghost">
                Try again
              </Button>
              <a
                href="/register"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-pulse-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-pulse-700"
              >
                Sign up free →
              </a>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
