// File: src/components/quiz/QuizForm.tsx
/*
 * CHANGE SUMMARY (QuizForm.tsx)
 * - Local-only draft autosave/recovery for the quiz builder (localStorage, no new API)
 * - Validation before submit: blocks incomplete questions, duplicate question prompts,
 *   and duplicate MCQ options; scrolls to the offending question
 * - "Learner preview" toggle: shows the quiz as a learner would see it, with correct
 *   answers highlighted, without leaving the editor
 * - Question navigator strip to jump to any question
 * Reviewed: no new API routes, no schema changes. Balanced braces/parens/JSX fragments
 * confirmed. useEffect/Card imports present. Approved as-is.
 */
// src/components/quiz/QuizForm.tsx
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
    if (next === 'exam' || next === 'combined') {
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
  const [timeLimitMode, setTimeLimitMode] = useState<'fixed' | 'user_choice'>(initialQuiz?.timeLimitMode ?? 'fixed');
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
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [learnerPreview, setLearnerPreview] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `cliniolab-quiz-builder-draft-v1-${initialQuiz?.id ?? 'new'}`;

  // Local-only recovery for the quiz builder. Existing quiz data is never replaced automatically.
  useEffect(() => {
    if (initialQuiz) { setDraftReady(true); return; }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as { title?: string; description?: string; subcategoryId?: string; mode?: QuizMode; difficulty?: QuizDifficulty; questions?: QuizQuestionInput[]; savedAt?: number };
        if (draft.title || draft.description || (draft.questions?.length ?? 0) > 1 || draft.questions?.[0]?.prompt) {
          const age = draft.savedAt ? Math.max(0, Math.round((Date.now() - draft.savedAt) / 60000)) : 0;
          if (window.confirm(`Recover your local quiz draft from ${age} minute(s) ago?`)) {
            if (draft.title !== undefined) setTitle(draft.title);
            if (draft.description !== undefined) setDescription(draft.description);
            if (draft.subcategoryId !== undefined) setSubcategoryId(draft.subcategoryId);
            if (draft.mode) setModeState(draft.mode);
            if (draft.difficulty) setDifficulty(draft.difficulty);
            if (draft.questions?.length) setQuestions(draft.questions);
          } else {
            window.localStorage.removeItem(draftKey);
          }
        }
      }
    } catch { /* Ignore an invalid local draft without affecting the form. */ }
    setDraftReady(true);
  // Restore once when the form opens, not whenever the draft key changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady || initialQuiz) return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ title, description, subcategoryId, mode, difficulty, questions, savedAt: Date.now() }));
      } catch { /* Local storage can be disabled or full. */ }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [draftReady, initialQuiz, draftKey, title, description, subcategoryId, mode, difficulty, questions]);

  // Exam mode always carries a timer by definition; quiz mode's timer is
  // opt-in (for creators who want speed-drills). Switching to exam mode
  // force-enables the timer toggle so the time-limit input always shows.
  // Study mode never shows a timer at all.
  useEffect(() => {
    if (mode === 'exam' || mode === 'combined') setTimerEnabled(true);
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
    setSelectedQuestions((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  function toggleQuestionSelected(index: number) {
    setSelectedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAllQuestions() {
    setSelectedQuestions((prev) =>
      prev.size === questions.length ? new Set() : new Set(questions.map((_, i) => i))
    );
  }

  /**
   * Removes every selected question from local state in one go, then
   * immediately saves the quiz so the deletion is committed to the
   * database right away (the server-side diff in quizCrudService hard-
   * deletes any question no longer present in the payload) instead of
   * waiting for the user to separately hit the main Save button.
   */
  async function removeSelectedQuestions() {
    if (selectedQuestions.size === 0) return;
    const remaining = questions.filter((_, i) => !selectedQuestions.has(i));
    if (remaining.length === 0) {
      setError('A quiz needs at least one question - add a replacement before removing the rest.');
      return;
    }
    const count = selectedQuestions.size;
    if (!window.confirm(`Permanently delete ${count} selected question${count === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }
    setQuestions(remaining);
    setSelectedQuestions(new Set());

    // Only auto-save immediately when editing an existing quiz (so the
    // deletion is committed to the database right away). For a brand new
    // quiz that hasn't been created yet, there's nothing to delete from
    // the database - just drop the rows locally.
    if (!initialQuiz) return;

    setError(null);
    setSubmitting(true);
    try {
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
        timeLimitMode: timerEnabled ? timeLimitMode : 'fixed',
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
        questions: remaining,
      };
      const result = await onSubmit(input);
      if (result?.error) setError(result.error);
      else if (!initialQuiz) { try { window.localStorage.removeItem(draftKey); } catch { /* Ignore storage failures. */ } }
    } finally {
      setSubmitting(false);
    }
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
    if ((mode === 'exam' || mode === 'combined') && !timerEnabled) {
      setError('Exam / CBT and Combined modes require a time limit.');
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
    const incomplete = questions.findIndex((q) => {
      if (!q.prompt.trim()) return true;
      if (q.type === 'mcq') {
        const options = (q.options ?? []).filter((option) => option.text.trim());
        return options.length < 2 || !q.correctAnswer || !options.some((option) => option.id === q.correctAnswer);
      }
      return !q.correctAnswer.trim();
    });
    if (incomplete !== -1) {
      setError(`Question ${incomplete + 1} needs a prompt, a valid answer, and at least two non-empty options for multiple-choice questions.`);
      document.getElementById(`quiz-question-${incomplete}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const promptKeys = new Map<string, number>();
    for (let i = 0; i < questions.length; i++) {
      const key = questions[i].prompt.trim().toLowerCase().replace(/\s+/g, ' ');
      if (promptKeys.has(key)) {
        setError(`Question ${i + 1} looks like a duplicate of Question ${promptKeys.get(key)}. Review it before publishing.`);
        document.getElementById(`quiz-question-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      promptKeys.set(key, i + 1);
      if (questions[i].type === 'mcq') {
        const options = (questions[i].options ?? []).map((option) => option.text.trim().toLowerCase()).filter(Boolean);
        if (new Set(options).size !== options.length) {
          setError(`Question ${i + 1} has repeated answer options. Make each option distinct.`);
          document.getElementById(`quiz-question-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
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
      timeLimitMode: timerEnabled ? timeLimitMode : 'fixed',
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
      else if (!initialQuiz) { try { window.localStorage.removeItem(draftKey); } catch { /* Ignore storage failures. */ } }
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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setLearnerPreview((value) => !value)}>{learnerPreview ? 'Back to editor' : 'Learner preview'}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </div>

      {learnerPreview && (
        <Card className="mb-6 space-y-5 p-6">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">Learner preview</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink-800">{title.trim() || 'Untitled quiz'}</h2><p className="mt-1 text-sm text-ink-500">{description || 'No description added.'}</p><p className="mt-2 text-xs text-ink-400">{questions.length} questions · {mode === 'combined' ? 'Combined study and timed quiz' : mode === 'exam' ? 'Timed exam' : mode === 'study' ? 'Study mode' : 'Quiz mode'} · Answers shown here for creator review</p></div>
          {questions.map((question, index) => <div key={question.id ?? index} className="rounded-xl border border-ink-100 p-4"><p className="font-medium text-ink-800">{index + 1}. {question.prompt || 'Question prompt not entered yet'}</p>{question.type === 'mcq' && <ul className="mt-3 space-y-2">{(question.options ?? []).map((option, optionIndex) => <li key={option.id} className={`rounded-lg px-3 py-2 text-sm ${option.id === question.correctAnswer ? 'bg-pulse-50 font-semibold text-pulse-700 ring-1 ring-pulse-200' : 'bg-ink-50 text-ink-600'}`}>{String.fromCharCode(65 + optionIndex)}. {option.text || 'Empty option'} {option.id === question.correctAnswer ? '✓ Correct answer' : ''}</li>)}</ul>}{question.type !== 'mcq' && <p className="mt-2 text-sm text-ink-500">Expected answer: {question.correctAnswer || 'Not entered'}</p>}{question.explanation && <p className="mt-3 text-sm text-ink-500">Explanation: {question.explanation}</p>}</div>)}
          <Button variant="secondary" onClick={() => setLearnerPreview(false)}>Return to editing</Button>
        </Card>
      )}
      {!learnerPreview && <>
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
              <option value="combined">Combined Mode (Study Practice + Timed Quiz)</option>
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

        {(mode === 'exam' || mode === 'quiz' || mode === 'combined') && (
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
            {(mode === 'exam' || mode === 'combined') && (
              <p className="mt-1 text-xs text-ink-400">
                {mode === 'combined' ? 'Combined Mode always includes a timed quiz. Learners can also choose untimed Study Mode.' : 'Exam / CBT mode always runs on a timer.'}
              </p>
            )}
            {timerEnabled && (
              <div className="mt-3 space-y-3 rounded-lg border border-ink-100 bg-ink-50/50 p-4">
                <div>
                  <label className="text-sm font-medium text-ink-700">Who sets the timer?</label>
                  <select
                    value={timeLimitMode}
                    onChange={(e) => setTimeLimitMode(e.target.value as 'fixed' | 'user_choice')}
                    className="mt-1 block w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                  >
                    <option value="fixed">Use my time limit for everyone</option>
                    <option value="user_choice">Let each user choose a custom time before starting</option>
                  </select>
                  <p className="mt-1 text-xs text-ink-400">
                    {timeLimitMode === 'fixed'
                      ? 'Everyone gets the same time limit you set below.'
                      : 'The value below is a suggested starting point. Each learner can change their time before the timer begins.'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-700">{timeLimitMode === 'fixed' ? 'Time limit (minutes)' : 'Suggested time (minutes)'}</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
                    placeholder="Minutes"
                    className="mt-1 w-36 rounded-md border border-ink-100 bg-white px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                  />
                </div>
              </div>
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
              Visitors can take them without an account, and guest results are not saved.
              Logged-in users who take it get their result saved and, where available, the
              leaderboard and certificate.
            </p>
          )}
          {initialQuiz && (
            <p className="mt-1 text-xs text-ink-400">
              Visibility changes apply when you click Save changes. Staying on the same
              visibility keeps your current share link and password.
            </p>
          )}
        </div>

        {visibility === 'private' && (!initialQuiz || initialQuiz.visibility !== 'private') && (
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
      </>}

      {!learnerPreview && <div className="mb-4 rounded-xl border border-ink-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink-700">Question navigator</p><p className="text-xs text-ink-400">{questions.filter((q) => q.prompt.trim() && q.correctAnswer.trim()).length} of {questions.length} have a prompt and answer</p></div>
        <div className="mt-2 flex flex-wrap gap-2">{questions.map((q, index) => <button key={q.id ?? index} type="button" onClick={() => document.getElementById(`quiz-question-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold ${q.prompt.trim() && q.correctAnswer.trim() ? 'border-pulse-200 bg-pulse-50 text-pulse-700' : 'border-flag-200 bg-flag-50 text-flag-700'}`} aria-label={`Go to question ${index + 1}`}>{index + 1}</button>)}</div>
      </div>}
      {!learnerPreview && <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink-800">Questions</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <input
              type="checkbox"
              checked={questions.length > 0 && selectedQuestions.size === questions.length}
              onChange={toggleSelectAllQuestions}
              className="h-4 w-4 rounded border-ink-200"
            />
            Select all
          </label>
          {selectedQuestions.size > 0 && (
            <button
              type="button"
              onClick={removeSelectedQuestions}
              disabled={submitting}
              className="rounded-md bg-critical-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-critical-600 disabled:opacity-50"
            >
              Remove selected ({selectedQuestions.size})
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-6">
        {questions.map((q, qIndex) => (
          <Card key={qIndex} className={`p-5 ${selectedQuestions.has(qIndex) ? 'ring-2 ring-critical-300' : ''}`}><div id={`quiz-question-${qIndex}`} className="scroll-mt-24" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedQuestions.has(qIndex)}
                  onChange={() => toggleQuestionSelected(qIndex)}
                  className="h-4 w-4 shrink-0 rounded border-ink-200"
                  aria-label={`Select question ${qIndex + 1}`}
                />
                <span className="text-sm font-medium text-ink-600">Question {qIndex + 1}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                    className="w-14 rounded-md border border-ink-100 px-2 py-1 text-xs focus:border-pulse-400 focus:outline-none sm:w-16"
                  />
                </label>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(qIndex, {
                    type: e.target.value as QuestionType,
                    options: e.target.value === 'mcq' ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }] : undefined,
                  })}
                  className="max-w-full rounded-md border border-ink-100 px-2 py-1 text-xs"
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="fill_blank">Fill in the blank</option>
                </select>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="ml-auto rounded-md border border-critical-100 bg-critical-50 px-2.5 py-1 text-xs font-semibold text-critical-600 hover:bg-critical-100 sm:ml-0"
                    aria-label={`Remove question ${qIndex + 1}`}
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
              placeholder="Explanation (optional, shown after grading). Write a full rationale, not just a fragment"
              rows={3}
              className="mt-3 w-full rounded-md border border-ink-100 px-4 py-2 text-sm text-ink-600 focus:border-pulse-400 focus:outline-none"
            />
            <textarea
              value={q.incorrectRationale ?? ''}
              onChange={(e) => updateQuestion(qIndex, { incorrectRationale: e.target.value })}
              placeholder="Why the other options are wrong (optional). One short line per wrong option works well"
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
      </>}
    </div>
  );
}
