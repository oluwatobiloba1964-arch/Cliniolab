'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import type {
  Category,
  LinkExpiryOption,
  QuestionType,
  Quiz,
  QuizDifficulty,
  QuizInput,
  QuizMode,
  QuizQuestion,
  QuizQuestionInput,
  QuizVisibility,
  RetakePolicy,
  Subcategory,
} from '@/types';

function emptyQuestion(): QuizQuestionInput {
  return {
    type: 'mcq',
    prompt: '',
    options: [
      { id: crypto.randomUUID(), text: '' },
      { id: crypto.randomUUID(), text: '' },
    ],
    correctAnswer: '',
    explanation: '',
    mark: null,
  };
}

/** Converts loaded QuizQuestion records (edit mode) into the input shape the form edits. */
function toQuestionInput(q: QuizQuestion): QuizQuestionInput {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? undefined,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? undefined,
    incorrectRationale: q.incorrectRationale ?? undefined,
    mark: q.mark,
  };
}

interface QuizFormProps {
  /** Pass an existing quiz + its questions to pre-fill the form for editing. Omit for create. */
  initialQuiz?: Quiz;
  initialQuestions?: QuizQuestion[];
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: QuizInput) => Promise<{ error?: string } | void>;
}

export function QuizForm({
  initialQuiz,
  initialQuestions,
  submitLabel,
  submittingLabel,
  onSubmit,
}: QuizFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [title, setTitle] = useState(initialQuiz?.title ?? '');
  const [description, setDescription] = useState(initialQuiz?.description ?? '');
  const [subcategoryId, setSubcategoryId] = useState(initialQuiz?.subcategoryId ?? '');
  const [mode, setModeState] = useState<QuizMode>(initialQuiz?.mode ?? 'quiz');
  function setMode(next: QuizMode) {
    setModeState(next);
    if (next === 'exam') {
      // Exam / CBT mode always runs on a timer, so force it on.
      setTimerEnabled(true);
    }
  }
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(initialQuiz?.difficulty ?? 'medium');
  const [timerEnabled, setTimerEnabled] = useState(
    initialQuiz?.mode === 'exam' || !!initialQuiz?.timeLimitSeconds
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    initialQuiz?.timeLimitSeconds ? Math.round(initialQuiz.timeLimitSeconds / 60) : 20
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(initialQuiz?.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState(initialQuiz?.shuffleOptions ?? false);
  const [visibility, setVisibility] = useState<QuizVisibility>(initialQuiz?.visibility ?? 'public');
  const [linkExpiry, setLinkExpiry] = useState<LinkExpiryOption>('7d');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [pricing, setPricing] = useState<'free' | 'paid'>(initialQuiz?.pricing ?? 'free');
  const [priceNaira, setPriceNaira] = useState(
    initialQuiz?.priceKobo ? Math.round(initialQuiz.priceKobo / 100) : 0
  );
  const [platformFeePercent, setPlatformFeePercent] = useState(15);
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(initialQuiz?.antiCheatEnabled ?? false);
  const [allowFlagging, setAllowFlagging] = useState(initialQuiz?.allowFlagging ?? true);
  const [defaultMark, setDefaultMark] = useState(initialQuiz?.defaultMark ?? 1);
  const [showMarks, setShowMarks] = useState(initialQuiz?.showMarks ?? true);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(initialQuiz?.leaderboardEnabled ?? true);
  const [retakePolicy, setRetakePolicy] = useState<RetakePolicy>(initialQuiz?.retakePolicy ?? 'unlimited');
  const [retakeLimit, setRetakeLimit] = useState(initialQuiz?.retakeLimit ?? 1);
  const [questions, setQuestions] = useState<QuizQuestionInput[]>(
    initialQuestions && initialQuestions.length > 0
      ? initialQuestions.map(toQuestionInput)
      : [emptyQuestion()]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exam mode always carries a timer by definition; quiz mode's timer is
  // opt-in (for creators who want speed-drills). Switching to exam mode
  // force-enables the timer toggle so the time-limit input always shows.
  // Study mode never shows a timer at all.
  useEffect(() => {
    if (mode === 'exam') setTimerEnabled(true);
  }, [mode]);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      });
    fetch('/api/admin/platform-fee')
      .then((res) => res.json())
      .then((data) => setPlatformFeePercent(data.platformFeePercent))
      .catch(() => {});
  }, []);

  function updateQuestion(index: number, patch: Partial<QuizQuestionInput>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, optIndex: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || !q.options) return q;
        const options = [...q.options];
        options[optIndex] = { ...options[optIndex], text };
        return { ...q, options };
      })
    );
  }

  function addOption(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options
          ? { ...q, options: [...q.options, { id: crypto.randomUUID(), text: '' }] }
          : q
      )
    );
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !subcategoryId || questions.length === 0) {
      setError('Title, category, and at least one question are required.');
      return;
    }
    if (visibility === 'private' && linkExpiry === 'custom' && !customExpiryDate) {
      setError('Please pick a custom expiry date for the private link.');
      return;
    }
    if (visibility === 'guest' && pricing === 'paid') {
      setError('Guest quizzes must be free. Switch pricing to Free or change visibility.');
      return;
    }
    if (pricing === 'paid' && priceNaira <= 0) {
      setError('Set a price greater than ₦0 for a paid quiz.');
      return;
    }
    if (mode === 'exam' && !timerEnabled) {
      setError('Exam / CBT mode requires a time limit.');
      return;
    }
    if (defaultMark < 1) {
      setError('Default mark must be at least 1.');
      return;
    }
    if (questions.some((q) => q.mark != null && q.mark < 1)) {
      setError('Question marks must be at least 1.');
      return;
    }

    const input: QuizInput = {
      subcategoryId,
      title: title.trim(),
      description: description.trim() || undefined,
      mode,
      difficulty,
      visibility,
      linkExpiry: visibility === 'private' ? linkExpiry : undefined,
      customExpiryDate: visibility === 'private' && linkExpiry === 'custom' ? customExpiryDate : undefined,
      timeLimitSeconds: timerEnabled ? timeLimitMinutes * 60 : undefined,
      shuffleQuestions,
      shuffleOptions,
      antiCheatEnabled,
      retakePolicy: antiCheatEnabled ? retakePolicy : 'unlimited',
      retakeLimit: antiCheatEnabled && retakePolicy !== 'single' ? retakeLimit : undefined,
      allowFlagging,
      defaultMark,
      showMarks,
      leaderboardEnabled: visibility === 'private' ? leaderboardEnabled : undefined,
      pricing,
      priceKobo: pricing === 'paid' ? Math.round(priceNaira * 100) : undefined,
      questions,
    };

    setSubmitting(true);
    try {
      const result = await onSubmit(input);
      if (result?.error) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Sticky top save bar - mirrors the bottom Save button. When a quiz has
          many questions (e.g. 100+), scrolling all the way down just to save
          an edit made near the top is tedious, so this stays reachable. */}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as QuizMode)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            >
              <option value="study">Study Mode (see answers immediately)</option>
              <option value="quiz">Quiz Mode (untimed, graded)</option>
              <option value="exam">Exam / CBT Mode (timed, graded)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {(mode === 'exam' || mode === 'quiz') && (
          <div>
            {mode === 'quiz' ? (
              <Toggle
                checked={timerEnabled}
                onChange={setTimerEnabled}
                label="Add a time limit (for speed-drills)"
              />
            ) : (
              <label className="text-sm font-medium text-ink-700">Time limit (minutes)</label>
            )}
            {mode === 'exam' && (
              <p className="mt-1 text-xs text-ink-400">
                Exam / CBT mode always runs on a timer.
              </p>
            )}
            {timerEnabled && (
              <input
                type="number"
                min={1}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                placeholder="Minutes"
                className="mt-2 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Toggle checked={shuffleQuestions} onChange={setShuffleQuestions} label="Shuffle question order" />
          <Toggle checked={shuffleOptions} onChange={setShuffleOptions} label="Shuffle answer options" />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">Visibility</label>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`rounded-md border px-4 py-2 text-sm ${visibility === 'public' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
            >
              Public (shows in Latest Quizzes)
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`rounded-md border px-4 py-2 text-sm ${visibility === 'private' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
            >
              Private (share link only)
            </button>
            <button
              type="button"
              onClick={() => {
                setVisibility('guest');
                setPricing('free');
              }}
              className={`rounded-md border px-4 py-2 text-sm ${visibility === 'guest' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
            >
              Guest (open to everyone, no login)
            </button>
          </div>
          {visibility === 'guest' && (
            <p className="mt-2 text-xs text-ink-500">
              Guest Practice quizzes are free and shown in the Guest Practice section on the homepage.
              Visitors can take them without an account, and results are not saved.
              Leaderboard and certificates do not apply.
            </p>
          )}
          {initialQuiz && (
            <p className="mt-1 text-xs text-ink-400">
              Changing visibility here updates the field only — use the dashboard&apos;s
              &quot;Regenerate link&quot; action if you also need a new share link or expiry.
            </p>
          )}
        </div>

        {visibility === 'private' && !initialQuiz && (
          <div>
            <label className="text-sm font-medium text-ink-700">Link expiry</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['1d', '3d', '7d', 'custom'] as LinkExpiryOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLinkExpiry(opt)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${linkExpiry === opt ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
                >
                  {opt === '1d' ? '1 day' : opt === '3d' ? '3 days' : opt === '7d' ? '7 days' : 'Custom'}
                </button>
              ))}
            </div>
            {linkExpiry === 'custom' && (
              <input
                type="datetime-local"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                className="mt-2 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
              />
            )}
          </div>
        )}

        {visibility === 'private' && (
          <div className="border-t border-ink-50 pt-4">
            <Toggle
              checked={leaderboardEnabled}
              onChange={setLeaderboardEnabled}
              label="Show a leaderboard for this quiz"
            />
            <p className="mt-1 text-xs text-ink-400">
              On by default. When on, anyone with the link can see this quiz&apos;s own
              leaderboard after they attempt it. If the site admin has turned leaderboards
              off entirely, this stays off no matter what you choose here.
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-ink-700">Pricing</label>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setPricing('free')}
              className={`rounded-md border px-4 py-2 text-sm ${pricing === 'free' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => setPricing('paid')}
              className={`rounded-md border px-4 py-2 text-sm ${pricing === 'paid' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
            >
              Paid
            </button>
          </div>
          {pricing === 'paid' && (
            <div className="mt-3">
              <input
                type="number"
                min={0}
                value={priceNaira}
                onChange={(e) => setPriceNaira(Number(e.target.value))}
                placeholder="Price in Naira"
                className="w-40 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
              />
              {priceNaira > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  Platform fee is currently <span className="font-semibold">{platformFeePercent}%</span>.
                  You&apos;ll earn{' '}
                  <span className="font-semibold text-pulse-600">
                    ₦{Math.round(priceNaira * (1 - platformFeePercent / 100)).toLocaleString('en-NG')}
                  </span>{' '}
                  of every ₦{priceNaira.toLocaleString('en-NG')} sale, paid directly to your bank
                  account.
                </p>
              )}
              <p className="mt-1 text-xs text-ink-400">
                You can switch this back to free at any time from your dashboard. Requires{' '}
                <a href="/dashboard/payout-setup" className="text-pulse-600 underline">payout details</a>{' '}
                to be set up before anyone can purchase it.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-ink-50 pt-4">
          <Toggle
            checked={antiCheatEnabled}
            onChange={setAntiCheatEnabled}
            label="Anti-cheat / limit retakes"
          />
          <p className="mt-1 text-xs text-ink-400">
            Off by default. When off, unlimited retakes are allowed but only the best attempt counts toward the leaderboard.
          </p>
          {antiCheatEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-600">Retake policy</label>
                <select
                  value={retakePolicy}
                  onChange={(e) => setRetakePolicy(e.target.value as RetakePolicy)}
                  className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                >
                  <option value="single">One attempt only</option>
                  <option value="daily_limit">Limited per day</option>
                  <option value="cooldown">Cooldown between attempts</option>
                </select>
              </div>
              {retakePolicy !== 'single' && (
                <div>
                  <label className="text-xs font-medium text-ink-600">
                    {retakePolicy === 'daily_limit' ? 'Attempts per day' : 'Cooldown (seconds)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={retakeLimit}
                    onChange={(e) => setRetakeLimit(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-ink-50 pt-4">
          <Toggle
            checked={allowFlagging}
            onChange={setAllowFlagging}
            label="Let quiz-takers flag bad or wrong questions"
          />
          <p className="mt-1 text-xs text-ink-400">
            On by default. When on, a &quot;Flag this question&quot; link appears on the results
            screen. Flagged questions show up under &quot;Flagged questions&quot; on your dashboard
            so you can fix or remove them.
          </p>
        </div>

        <div className="border-t border-ink-50 pt-4">
          <label className="text-sm font-medium text-ink-700">Default mark per question</label>
          <p className="mt-1 text-xs text-ink-400">
            Applied to every question unless you set a custom mark on that question below.
          </p>
          <input
            type="number"
            min={1}
            value={defaultMark}
            onChange={(e) => setDefaultMark(Math.max(1, Number(e.target.value)))}
            className="mt-2 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <div className="mt-4">
            <Toggle
              checked={showMarks}
              onChange={setShowMarks}
              label="Show marks to quiz-takers"
            />
            <p className="mt-1 text-xs text-ink-400">
              On by default. When on, quiz-takers see how many marks each question is worth while
              taking the quiz, and their marks earned on the results screen.
            </p>
          </div>
        </div>
      </Card>

      <h2 className="mt-10 font-display text-xl font-semibold text-ink-800">Questions</h2>
      <div className="mt-4 space-y-6">
        {questions.map((q, qIndex) => (
          <Card key={qIndex} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-600">Question {qIndex + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-ink-500">
                  Mark
                  <input
                    type="number"
                    min={1}
                    value={q.mark ?? ''}
                    onChange={(e) =>
                      updateQuestion(qIndex, {
                        mark: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                    placeholder={String(defaultMark)}
                    className="w-16 rounded-md border border-ink-100 px-2 py-1 text-xs focus:border-pulse-400 focus:outline-none"
                  />
                </label>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(qIndex, {
                    type: e.target.value as QuestionType,
                    options: e.target.value === 'mcq' ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }] : undefined,
                  })}
                  className="rounded-md border border-ink-100 px-2 py-1 text-xs"
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="fill_blank">Fill in the blank</option>
                </select>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="text-xs font-medium text-critical-500 hover:text-critical-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={q.prompt}
              onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
              placeholder="Question prompt"
              className="mt-3 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
              rows={2}
            />

            {q.type === 'mcq' && (
              <div className="mt-3 space-y-2">
                {q.options?.map((opt, optIndex) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={q.correctAnswer === opt.id}
                      onChange={() => updateQuestion(qIndex, { correctAnswer: opt.id })}
                    />
                    <input
                      value={opt.text}
                      onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                      className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(qIndex)}
                  className="text-xs font-medium text-pulse-600 hover:text-pulse-700"
                >
                  + Add option
                </button>
              </div>
            )}

            {q.type === 'true_false' && (
              <div className="mt-3 flex gap-3">
                {['True', 'False'].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={q.correctAnswer === v}
                      onChange={() => updateQuestion(qIndex, { correctAnswer: v })}
                    />
                    {v}
                  </label>
                ))}
              </div>
            )}

            {q.type === 'fill_blank' && (
              <input
                value={q.correctAnswer}
                onChange={(e) => updateQuestion(qIndex, { correctAnswer: e.target.value })}
                placeholder="Correct answer"
                className="mt-3 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
              />
            )}

            <textarea
              value={q.explanation ?? ''}
              onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
              placeholder="Explanation (optional, shown after grading) — write a full rationale, not just a fragment"
              rows={3}
              className="mt-3 w-full rounded-md border border-ink-100 px-4 py-2 text-sm text-ink-600 focus:border-pulse-400 focus:outline-none"
            />
            <textarea
              value={q.incorrectRationale ?? ''}
              onChange={(e) => updateQuestion(qIndex, { incorrectRationale: e.target.value })}
              placeholder="Why the other options are wrong (optional) — one short line per wrong option works well"
              rows={2}
              className="mt-2 w-full rounded-md border border-ink-100 px-4 py-2 text-sm text-ink-600 focus:border-pulse-400 focus:outline-none"
            />
          </Card>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}>
          + Add question
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}

      <div className="mt-8">
        <Button size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
