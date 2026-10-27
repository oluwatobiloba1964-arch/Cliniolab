'use client';

// src/app/quizzes/[quizId]/add-questions/page.tsx
//
// "Upload more questions to an existing quiz" - the counterpart to
// /quizzes/bulk-upload (which only ever creates brand-new quizzes).
// Accepts a CSV/XLSX/JSON file of QUESTIONS ONLY (no quiz-level columns
// like title/subcategory/mode - those stay whatever the existing quiz
// already has) and appends them via POST /api/quizzes/[quizId]/questions.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Quiz, QuestionOption, QuestionType, QuizQuestionInput } from '@/types';

const CSV_HEADERS = [
  'question_type',
  'prompt',
  'option_1',
  'option_2',
  'option_3',
  'option_4',
  'correct_answer',
  'explanation',
  'incorrect_rationale',
];

const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  [
    'mcq', 'Which chamber pumps blood to the lungs?',
    'Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle',
    'Right ventricle', 'The right ventricle pumps deoxygenated blood to the lungs.',
    'Right atrium receives blood from the body. Left atrium receives oxygenated blood. Left ventricle pumps to the body.',
  ].map(csvEscape).join(','),
  [
    'true_false', 'The mitral valve is on the right side of the heart.',
    '', '', '', '',
    'False', 'The mitral valve is on the left side, between atrium and ventricle.',
    '',
  ].map(csvEscape).join(','),
].join('\n');

const JSON_TEMPLATE = {
  questions: [
    {
      type: 'mcq',
      prompt: 'Which chamber pumps blood to the lungs?',
      options: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
      correctAnswer: 'Right ventricle',
      explanation: 'The right ventricle pumps deoxygenated blood to the lungs.',
      incorrectRationale: 'Right atrium receives blood from the body. Left atrium receives oxygenated blood. Left ventricle pumps to the body.',
    },
    {
      type: 'true_false',
      prompt: 'The mitral valve is on the right side of the heart.',
      correctAnswer: 'False',
      explanation: 'The mitral valve is on the left side, between atrium and ventricle.',
    },
  ],
};

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Same SheetJS-backed reader as the quiz bulk-upload page, so .xlsx/.xls/.ods/.csv all work. */
async function parseSpreadsheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  return grid
    .map((row) => row.map((cell) => (cell ?? '').toString()))
    .filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Parses one question row into a QuizQuestionInput, same rules as the quiz bulk-upload page's buildQuestionInput. */
function buildQuestionInput(cols: Record<string, string>): { input: QuizQuestionInput | null; error?: string } {
  const type = (cols.question_type || 'mcq').trim().toLowerCase() as QuestionType;
  const prompt = (cols.prompt || '').trim();
  const correctAnswer = (cols.correct_answer || '').trim();
  const explanation = cols.explanation?.trim() || undefined;
  const incorrectRationale = cols.incorrect_rationale?.trim() || undefined;

  if (!prompt) return { input: null, error: 'missing prompt' };
  if (!['mcq', 'true_false', 'fill_blank', 'sata', 'ordering', 'matrix', 'highlight'].includes(type)) {
    return { input: null, error: `invalid question_type "${type}"` };
  }
  if (!correctAnswer) return { input: null, error: 'missing correct_answer' };

  if (type === 'mcq') {
    const options: QuestionOption[] = ['option_1', 'option_2', 'option_3', 'option_4']
      .map((key) => cols[key]?.trim())
      .filter((text): text is string => !!text)
      .map((text) => ({ id: crypto.randomUUID(), text }));

    if (options.length < 2) return { input: null, error: 'MCQ needs at least 2 options' };

    const duplicateOptions = new Set(options.map((o) => normalizeText(o.text)));
    if (duplicateOptions.size !== options.length) {
      return { input: null, error: 'MCQ options must be unique' };
    }

    let matched = options.find((o) => normalizeText(o.text) === normalizeText(correctAnswer));
    if (!matched) {
      const letterMatch = normalizeText(correctAnswer).match(/^([a-d])[.)]?$/);
      if (letterMatch) {
        const letterIndex = letterMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);
        matched = options[letterIndex];
      }
    }
    if (!matched) {
      return { input: null, error: 'correct_answer must match one of the MCQ options, or be its letter (A-D)' };
    }

    return { input: { type, prompt, options, correctAnswer: matched.id, explanation, incorrectRationale } };
  }

  if (type === 'true_false' && !['true', 'false'].includes(normalizeText(correctAnswer))) {
    return { input: null, error: 'true_false correct_answer must be True or False' };
  }

  return { input: { type, prompt, correctAnswer, explanation, incorrectRationale } };
}

function rowsToQuestions(rows: string[][]): { questions: QuizQuestionInput[]; warnings: string[] } {
  const [header, ...body] = rows;
  const warnings: string[] = [];
  const normalized = header.map((h) => h.trim().toLowerCase());
  for (const col of ['question_type', 'prompt', 'correct_answer']) {
    if (!normalized.includes(col)) {
      warnings.push(`Missing required column "${col}". Add it as a header in row 1.`);
    }
  }
  const known = new Set<string>(CSV_HEADERS);
  const unknown = header.filter((h) => h.trim() && !known.has(h.trim().toLowerCase()));
  if (unknown.length > 0) {
    warnings.push(`Unrecognized column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Check for typos - these will be ignored.`);
  }

  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const colIndex: Record<string, number> = {};
  for (const h of CSV_HEADERS) colIndex[h] = idx(h);

  const questions: QuizQuestionInput[] = [];
  body.forEach((row, i) => {
    const cols: Record<string, string> = {};
    for (const h of CSV_HEADERS) {
      const at = colIndex[h];
      cols[h] = at >= 0 ? (row[at] ?? '') : '';
    }
    const { input, error } = buildQuestionInput(cols);
    if (!input) {
      warnings.push(`Row ${i + 2}: ${error ?? 'could not be parsed'}, skipped.`);
      return;
    }
    questions.push(input);
  });

  return { questions, warnings };
}

type JsonQuestionDraft = {
  type?: string;
  prompt?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  incorrectRationale?: string;
};

function jsonDraftsToQuestions(drafts: JsonQuestionDraft[]): { questions: QuizQuestionInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const questions: QuizQuestionInput[] = [];

  drafts.forEach((draft, i) => {
    const type = (draft.type || 'mcq').trim().toLowerCase() as QuestionType;
    const prompt = (draft.prompt || '').trim();
    const correctAnswerRaw = (draft.correctAnswer || '').trim();
    const explanation = draft.explanation?.trim() || undefined;
    const incorrectRationale = draft.incorrectRationale?.trim() || undefined;

    if (!prompt) { warnings.push(`Question ${i + 1}: missing prompt, skipped.`); return; }
    if (!['mcq', 'true_false', 'fill_blank', 'sata', 'ordering', 'matrix', 'highlight'].includes(type)) {
      warnings.push(`Question ${i + 1}: invalid type "${type}", skipped.`);
      return;
    }
    if (!correctAnswerRaw) { warnings.push(`Question ${i + 1}: missing correctAnswer, skipped.`); return; }

    if (type === 'mcq') {
      const optionTexts = (draft.options ?? []).map((t) => t.trim()).filter(Boolean);
      if (optionTexts.length < 2) { warnings.push(`Question ${i + 1}: MCQ needs at least 2 options, skipped.`); return; }
      const options: QuestionOption[] = optionTexts.map((text) => ({ id: crypto.randomUUID(), text }));
      const duplicateOptions = new Set(options.map((o) => normalizeText(o.text)));
      if (duplicateOptions.size !== options.length) {
        warnings.push(`Question ${i + 1}: MCQ options must be unique, skipped.`);
        return;
      }
      const matched = options.find((o) => normalizeText(o.text) === normalizeText(correctAnswerRaw));
      if (!matched) {
        warnings.push(`Question ${i + 1}: correctAnswer must match one of the options, skipped.`);
        return;
      }
      questions.push({ type, prompt, options, correctAnswer: matched.id, explanation, incorrectRationale });
      return;
    }

    if (type === 'true_false' && !['true', 'false'].includes(normalizeText(correctAnswerRaw))) {
      warnings.push(`Question ${i + 1}: true_false correctAnswer must be True or False, skipped.`);
      return;
    }

    questions.push({ type, prompt, correctAnswer: correctAnswerRaw, explanation, incorrectRationale });
  });

  return { questions, warnings };
}

export default function AddQuestionsPage() {
  const router = useRouter();
  const params = useParams<{ quizId: string }>();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestionInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warningSearch, setWarningSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!params?.quizId) return;
    fetch(`/api/quizzes/${params.quizId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setLoadError(data.error ?? 'Failed to load quiz'); return; }
        setQuiz(data.quiz);
      })
      .catch(() => setLoadError('Network error while loading quiz'))
      .finally(() => setLoadingQuiz(false));
  }, [params?.quizId]);

  const filteredWarnings = useMemo(() => {
    const query = warningSearch.trim().toLowerCase();
    return warnings.map((message, index) => ({ message, index })).filter(({ message }) => !query || message.toLowerCase().includes(query));
  }, [warnings, warningSearch]);

  function downloadTemplate(format: 'csv' | 'json') {
    if (format === 'json') {
      downloadBlob(JSON.stringify(JSON_TEMPLATE, null, 2), 'cliniolab-add-questions-template.json', 'application/json');
    } else {
      downloadBlob(CSV_TEMPLATE, 'cliniolab-add-questions-template.csv', 'text/csv');
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setSubmitError(null);
    setAddedCount(null);
    setParsedQuestions([]);
    setWarnings([]);

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text) as { questions?: JsonQuestionDraft[] };
        if (!Array.isArray(parsed.questions)) {
          setWarnings(['JSON file must have a top-level "questions" array.']);
          return;
        }
        const { questions, warnings: w } = jsonDraftsToQuestions(parsed.questions);
        setParsedQuestions(questions);
        setWarnings(w);
        return;
      }

      const rows = await parseSpreadsheet(file);
      if (rows.length === 0) {
        setWarnings(['File has no data rows.']);
        return;
      }
      const { questions, warnings: w } = rowsToQuestions(rows);
      setParsedQuestions(questions);
      setWarnings(w);
    } catch {
      setWarnings(['Could not read this file. Check it is a valid CSV, Excel, ODS, or JSON file.']);
    }
  }

  async function handleSubmit() {
    if (parsedQuestions.length === 0 || !params?.quizId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/quizzes/${params.quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: parsedQuestions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Upload failed');
        return;
      }
      setAddedCount(data.added ?? parsedQuestions.length);
      setParsedQuestions([]);
      setFileName(null);
    } catch {
      setSubmitError('Network error while uploading. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || loadingQuiz) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to add questions to a quiz.</p>
        <Button className="mt-6" onClick={() => router.push(`/login?next=${encodeURIComponent(`/quizzes/${params.quizId}/add-questions`)}`)}>
          Log in
        </Button>
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Can&apos;t add questions</h1>
        <p className="mt-2 text-ink-500">{loadError ?? 'Quiz not found.'}</p>
        <Button className="mt-6" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Add questions to &quot;{quiz.title}&quot;</h1>
      <p className="mt-2 text-ink-500">
        Upload a file of new questions to append to this quiz. The quiz&apos;s title, category, mode, and other
        settings stay unchanged  -  only new questions are added, nothing existing is touched or removed.
      </p>

      <Card className="mt-8 p-6">
        <h2 className="font-semibold text-ink-800">1. Get the template</h2>
        <p className="mt-1 text-sm text-ink-500">Columns: question_type, prompt, option_1-4 (MCQ only), correct_answer, explanation, incorrect_rationale.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadTemplate('csv')}>Download CSV template</Button>
          <Button variant="secondary" size="sm" onClick={() => downloadTemplate('json')}>Download JSON template</Button>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-ink-800">2. Upload your file</h2>
        <p className="mt-1 text-sm text-ink-500">CSV, Excel (.xlsx/.xls), OpenDocument (.ods), or JSON.</p>
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.ods,.json"
            onChange={handleFileChange}
            className="block w-full text-sm text-ink-600 file:mr-4 file:rounded-lg file:border-0 file:bg-pulse-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-pulse-600"
          />
          {fileName && <p className="mt-2 text-xs text-ink-400">Selected: {fileName}</p>}
        </div>
      </Card>

      {warnings.length > 0 && (
        <Card className="mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink-800">Warnings ({warnings.length})</h2>
            <input
              value={warningSearch}
              onChange={(e) => setWarningSearch(e.target.value)}
              placeholder="Search warnings..."
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs outline-none focus:border-pulse-400"
            />
          </div>
          <ul className="mt-3 space-y-1 text-sm text-critical-700">
            {filteredWarnings.map(({ message, index }) => <li key={index}>• {message}</li>)}
          </ul>
        </Card>
      )}

      {parsedQuestions.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-ink-800">3. Review and add</h2>
          <p className="mt-1 text-sm text-ink-500">
            {parsedQuestions.length} question{parsedQuestions.length === 1 ? '' : 's'} ready to add to this quiz.
          </p>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
            {parsedQuestions.map((q, i) => (
              <li key={i} className="rounded-lg border border-ink-100 p-3">
                <p className="font-medium text-ink-800">{i + 1}. {q.prompt}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-ink-400">{q.type.replace('_', ' ')}</p>
              </li>
            ))}
          </ul>
          {submitError && <p className="mt-3 text-sm text-critical-600">{submitError}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Adding…' : `Add ${parsedQuestions.length} question${parsedQuestions.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="secondary" onClick={() => { setParsedQuestions([]); setFileName(null); setWarnings([]); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {addedCount !== null && (
        <Card className="mt-6 border-pulse-100 bg-pulse-50 p-6">
          <p className="font-semibold text-pulse-800">{addedCount} question{addedCount === 1 ? '' : 's'} added.</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={() => router.push(`/quizzes/${params.quizId}`)}>View quiz</Button>
            <Button variant="secondary" onClick={() => setAddedCount(null)}>Add more</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
