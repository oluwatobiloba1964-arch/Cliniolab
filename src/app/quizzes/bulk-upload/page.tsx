'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { clearDraft, loadDraft, saveDraft } from '@/lib/localDraft';
import type { QuizInput, QuizMode, QuizDifficulty, QuestionType, QuestionOption } from '@/types';

// ---------------------------------------------------------------------------
// CSV shape: one row per QUESTION. Rows sharing the same quiz_title are
// grouped into a single quiz. Quiz-level columns (mode, time limit, etc.)
// are read from the first row seen for that title — repeat them on every
// row for that quiz so the sheet stays easy to skim in a spreadsheet.
//
// Columns:
//   quiz_title, category, subcategory, mode, difficulty, time_limit_minutes,
//   question_type, prompt, option_1, option_2, option_3, option_4,
//   correct_answer, explanation
//
// - mode: study | quiz | exam
// - question_type: mcq | true_false | fill_blank
// - For mcq: correct_answer must exactly match the text of one of the
//   option_N columns for that row.
// - For true_false: correct_answer is "True" or "False"; option columns
//   are ignored.
// - For fill_blank: correct_answer is the accepted text answer; option
//   columns are ignored.
// - time_limit_minutes: leave blank for no timer. Required for exam mode.
// - category: only needed if "subcategory" doesn't already exist on
//   Cliniolab. When both are new, both get created together (see
//   "Add new categories?" step during upload). Leave blank if
//   "subcategory" already exists — the existing one is matched as before.
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  'quiz_title',
  'category',
  'subcategory',
  'mode',
  'difficulty',
  'time_limit_minutes',
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
    'Cardiac Basics', 'Medicine', 'Cardiology', 'quiz', 'medium', '10',
    'mcq', 'Which chamber pumps blood to the lungs?',
    'Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle',
    'Right ventricle', 'The right ventricle pumps deoxygenated blood to the lungs.',
    'Right atrium receives blood from the body. Left atrium receives oxygenated blood. Left ventricle pumps to the body.',
  ].map(csvEscape).join(','),
  [
    'Cardiac Basics', 'Medicine', 'Cardiology', 'quiz', 'medium', '10',
    'true_false', 'The mitral valve is on the right side of the heart.',
    '', '', '', '',
    'False', 'The mitral valve is on the left side, between atrium and ventricle.',
    '',
  ].map(csvEscape).join(','),
  [
    'NCLEX Mock Exam A', 'Nursing', 'Exam Prep', 'exam', 'hard', '30',
    'fill_blank', 'The normal adult resting heart rate range is ___ to ___ bpm.',
    '', '', '', '',
    '60-100', 'Normal sinus rhythm for adults is generally 60-100 beats per minute.',
    '',
  ].map(csvEscape).join(','),
].join('\n');

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Same three example questions as CSV_TEMPLATE, shaped as the JSON upload format. */
const JSON_TEMPLATE = {
  quizzes: [
    {
      title: 'Cardiac Basics',
      category: 'Medicine',
      subcategory: 'Cardiology',
      mode: 'quiz',
      difficulty: 'medium',
      timeLimitMinutes: 10,
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
    },
    {
      title: 'NCLEX Mock Exam A',
      category: 'Nursing',
      subcategory: 'Exam Prep',
      mode: 'exam',
      difficulty: 'hard',
      timeLimitMinutes: 30,
      questions: [
        {
          type: 'fill_blank',
          prompt: 'The normal adult resting heart rate range is ___ to ___ bpm.',
          correctAnswer: '60-100',
          explanation: 'Normal sinus rhythm for adults is generally 60-100 beats per minute.',
        },
      ],
    },
  ],
};

type TemplateFormat = 'xlsx' | 'xls' | 'ods' | 'csv' | 'json';

const TEMPLATE_FORMAT_OPTIONS: { value: TemplateFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'xls', label: 'Excel 97-2003 (.xls)' },
  { value: 'ods', label: 'OpenDocument (.ods)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
];

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

/**
 * Reads any supported spreadsheet (xlsx, xls, ods, csv) with SheetJS and
 * returns the first sheet as a plain grid of strings — same shape the old
 * CSV-only parser produced, so the rest of the pipeline doesn't change.
 */
async function parseSpreadsheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return grid
    .map((row) => row.map((cell) => (cell ?? '').toString()))
    .filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Checks the header row against the expected columns and returns
 * human-readable warnings for anything missing, misspelled, or extra —
 * this is what lets a quiz maker see exactly what to fix instead of
 * silently getting empty/skipped rows.
 */
function validateHeaders(header: string[]): string[] {
  const warnings: string[] = [];
  const normalized = header.map((h) => h.trim().toLowerCase());
  const required = ['quiz_title', 'subcategory', 'question_type', 'prompt', 'correct_answer'];

  for (const col of required) {
    if (!normalized.includes(col)) {
      warnings.push(`Missing required column "${col}". Add it as a header in row 1.`);
    }
  }

  const known = new Set<string>(CSV_HEADERS);
  const unknown = header.filter((h) => h.trim() && !known.has(h.trim().toLowerCase()));
  if (unknown.length > 0) {
    warnings.push(
      `Unrecognized column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Check for typos — these will be ignored.`
    );
  }

  return warnings;
}

function buildQuestionInput(cols: Record<string, string>): {
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
  incorrectRationale?: string;
} {
  const type = (cols.question_type || 'mcq').trim() as QuestionType;
  const prompt = (cols.prompt || '').trim();
  const correctAnswer = (cols.correct_answer || '').trim();
  const explanation = cols.explanation?.trim() || undefined;
  const incorrectRationale = cols.incorrect_rationale?.trim() || undefined;

  if (type === 'mcq') {
    const options: QuestionOption[] = ['option_1', 'option_2', 'option_3', 'option_4']
      .map((key) => cols[key]?.trim())
      .filter((text): text is string => !!text)
      .map((text) => ({ id: crypto.randomUUID(), text }));

    const matched = options.find((o) => o.text === correctAnswer);
    return {
      type,
      prompt,
      options,
      correctAnswer: matched ? matched.id : correctAnswer,
      explanation,
      incorrectRationale,
    };
  }

  return { type, prompt, correctAnswer, explanation, incorrectRationale };
}

/**
 * Groups flat CSV rows into per-quiz QuizInput objects, in first-seen
 * order. Any quiz whose subcategory isn't in subcategoryLookup is held
 * back (not built, not warned-and-dropped) and reported in
 * `unresolvedSubcategories` instead, so the caller can offer to create
 * those categories/subcategories and re-run this same grouping once
 * they're resolved, rather than forcing a stop-fix-reupload cycle.
 */
function rowsToQuizInputs(
  rows: string[][],
  subcategoryLookup: Map<string, string>
): {
  quizzes: QuizInput[];
  warnings: string[];
  unresolvedSubcategories: { category: string; subcategory: string; quizTitles: string[] }[];
} {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const warnings: string[] = validateHeaders(header);

  const colIndex: Record<string, number> = {};
  for (const h of CSV_HEADERS) colIndex[h] = idx(h);

  const grouped = new Map<string, { meta: Record<string, string>; rows: Record<string, string>[] }>();

  body.forEach((row, i) => {
    const cols: Record<string, string> = {};
    for (const h of CSV_HEADERS) {
      const at = colIndex[h];
      cols[h] = at >= 0 ? (row[at] ?? '') : '';
    }
    const title = cols.quiz_title.trim();
    if (!title) {
      warnings.push(`Row ${i + 2}: missing quiz_title, skipped.`);
      return;
    }
    if (!grouped.has(title)) grouped.set(title, { meta: cols, rows: [] });
    grouped.get(title)!.rows.push(cols);
  });

  const quizzes: QuizInput[] = [];
  // Keyed by "category\u0000subcategory" (case-insensitive) so the same
  // pair mentioned across several quizzes is only reported once, with
  // every affected quiz title listed together.
  const unresolvedMap = new Map<string, { category: string; subcategory: string; quizTitles: string[] }>();

  for (const [title, { meta, rows: qRows }] of grouped) {
    const subcategoryName = meta.subcategory.trim();
    const subcategoryId = subcategoryLookup.get(subcategoryName.toLowerCase());

    if (!subcategoryId) {
      const categoryName = meta.category.trim();
      if (!categoryName) {
        // No category given and the subcategory doesn't exist -- can't
        // auto-create without a parent category, so this stays a hard
        // skip, same as before.
        warnings.push(
          `Quiz "${title}": subcategory "${subcategoryName}" not recognized, and no "category" column value was given to create it under. Add a category name for this row, or use an existing subcategory. Skipped.`
        );
        continue;
      }
      const key = `${categoryName.toLowerCase()}\u0000${subcategoryName.toLowerCase()}`;
      const entry = unresolvedMap.get(key);
      if (entry) entry.quizTitles.push(title);
      else unresolvedMap.set(key, { category: categoryName, subcategory: subcategoryName, quizTitles: [title] });
      continue;
    }

    const mode = (meta.mode.trim() || 'quiz') as QuizMode;
    const minutesRaw = meta.time_limit_minutes.trim();
    const minutes = minutesRaw ? Number(minutesRaw) : undefined;
    const timeLimitSeconds = minutes && minutes > 0 ? minutes * 60 : undefined;

    if (mode === 'exam' && !timeLimitSeconds) {
      warnings.push(`Quiz "${title}": exam mode requires time_limit_minutes, skipped.`);
      continue;
    }

    quizzes.push({
      subcategoryId,
      title,
      mode,
      difficulty: (meta.difficulty.trim() || 'medium') as QuizDifficulty,
      visibility: 'public',
      timeLimitSeconds,
      antiCheatEnabled: false,
      retakePolicy: 'unlimited',
      pricing: 'free',
      questions: qRows.map(buildQuestionInput),
    });
  }

  return { quizzes, warnings, unresolvedSubcategories: Array.from(unresolvedMap.values()) };
}


/** Raw JSON upload shape: category/subcategory as names, resolved to a
 *  subcategoryId the same way CSV rows are, before reaching QuizInput. */
type JsonQuizDraft = Omit<QuizInput, 'subcategoryId'> & {
  category?: string;
  subcategory: string;
  subcategoryId?: string;
};

export default function BulkUploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuizzes, setParsedQuizzes] = useState<QuizInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<{ name: string; id: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<{
    duplicateTitleIndexes: number[];
    duplicateQuestionsByQuizIndex: Record<number, { prompt: string; reason: 'already_in_subcategory' | 'duplicate_in_quiz' }[]>;
  } | null>(null);
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('xlsx');

  // Held between "we found unrecognized subcategories" and the user
  // deciding whether to create them, so we can re-run grouping afterward
  // without asking them to re-select/re-upload the file.
  const [pendingRows, setPendingRows] = useState<string[][] | null>(null);
  const [pendingJsonDrafts, setPendingJsonDrafts] = useState<JsonQuizDraft[] | null>(null);
  const [unresolvedSubcategories, setUnresolvedSubcategories] = useState<
    { category: string; subcategory: string; quizTitles: string[] }[]
  >([]);
  const [creatingSubcategories, setCreatingSubcategories] = useState(false);

  // Resumable draft of the parsed-but-not-yet-published preview, so
  // closing the tab or refreshing after a big upload doesn't force
  // re-picking the file and re-parsing from scratch. Mirrors the same
  // save/load/clear pattern QuizRunner and StudyModeRunner use for
  // in-progress attempts, just namespaced for this page instead of a
  // specific quiz id.
  const PREVIEW_DRAFT_NAMESPACE = 'bulk-upload-preview';
  const PREVIEW_DRAFT_ID = 'current';

  const subcategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subcategoryOptions) map.set(s.name.toLowerCase(), s.id);
    return map;
  }, [subcategoryOptions]);

  async function loadSubcategories(): Promise<Map<string, string>> {
    const res = await fetch('/api/categories');
    const data = await res.json();
    const options = (data.subcategories ?? []).map((s: { id: string; name: string }) => ({
      id: s.id,
      name: s.name,
    }));
    setSubcategoryOptions(options);
    const map = new Map<string, string>();
    for (const s of options) map.set(s.name.toLowerCase(), s.id);
    return map;
  }

  async function ensureSubcategoriesLoaded() {
    if (subcategoryOptions.length > 0) return subcategoryLookup;
    return loadSubcategories();
  }

  // Restore a preview left in progress from an earlier visit (e.g. the tab
  // was closed before hitting Publish). Runs once on mount.
  const restoredDraft = useRef(false);
  if (!restoredDraft.current && typeof window !== 'undefined') {
    restoredDraft.current = true;
    const draft = loadDraft<{
      fileName: string;
      parsedQuizzes: QuizInput[];
      warnings: string[];
    }>(PREVIEW_DRAFT_NAMESPACE, PREVIEW_DRAFT_ID);
    if (draft && draft.parsedQuizzes.length > 0) {
      // Deferred to a microtask so this doesn't try to setState during
      // the initial render pass.
      queueMicrotask(() => {
        setFileName(draft.fileName);
        setParsedQuizzes(draft.parsedQuizzes);
        setWarnings(draft.warnings);
      });
    }
  }

  // Autosave the preview as soon as there's something worth protecting.
  // Cleared on successful publish or explicit cancel (see handleSubmit /
  // the Cancel button below) — never on a plain reload, which is exactly
  // the case this exists to survive.
  useEffect(() => {
    if (parsedQuizzes.length === 0) {
      clearDraft(PREVIEW_DRAFT_NAMESPACE, PREVIEW_DRAFT_ID);
      return;
    }
    saveDraft(PREVIEW_DRAFT_NAMESPACE, PREVIEW_DRAFT_ID, { fileName, parsedQuizzes, warnings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, parsedQuizzes, warnings]);

  function clearPreviewDraft() {
    clearDraft(PREVIEW_DRAFT_NAMESPACE, PREVIEW_DRAFT_ID);
  }

  async function handleFile(file: File) {
    setSubmitError(null);
    setSubmittedCount(null);
    setFileName(file.name);
    setUnresolvedSubcategories([]);
    setPendingRows(null);
    setPendingJsonDrafts(null);
    const lookup = await ensureSubcategoriesLoaded();
    const lowerName = file.name.toLowerCase();

    try {
      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const drafts: JsonQuizDraft[] = Array.isArray(data) ? data : data.quizzes;
        if (!Array.isArray(drafts)) throw new Error('JSON must be an array or { "quizzes": [...] }');
        applyJsonDrafts(drafts, lookup);
      } else {
        // Handles .xlsx, .xls, .ods, and .csv — all read the same way via SheetJS.
        const rows = await parseSpreadsheet(file);
        if (rows.length < 2) {
          throw new Error(
            'No data rows found. Row 1 must be the column headers, with your questions starting on row 2.'
          );
        }
        applyRows(rows, lookup);
      }
    } catch (err) {
      setParsedQuizzes([]);
      setSubmitError(err instanceof Error ? err.message : 'Could not parse file.');
    }
  }

  /** Runs CSV/XLSX rows through the grouping logic and updates state, holding the raw rows onto pendingRows if anything needs a category/subcategory to be created first. */
  function applyRows(rows: string[][], lookup: Map<string, string>) {
    const { quizzes, warnings: w, unresolvedSubcategories: unresolved } = rowsToQuizInputs(rows, lookup);
    setParsedQuizzes(quizzes);
    setWarnings(w);
    if (unresolved.length > 0) {
      setPendingRows(rows);
      setUnresolvedSubcategories(unresolved);
    } else {
      setPendingRows(null);
      setUnresolvedSubcategories([]);
    }
  }

  /** Same idea as applyRows, but for parsed JSON quiz drafts (category/subcategory as plain names instead of a pre-resolved subcategoryId). */
  function applyJsonDrafts(drafts: JsonQuizDraft[], lookup: Map<string, string>) {
    const quizzes: QuizInput[] = [];
    const unresolvedMap = new Map<string, { category: string; subcategory: string; quizTitles: string[] }>();

    for (const draft of drafts) {
      const subcategoryName = (draft.subcategoryId ? '' : draft.subcategory || '').trim();
      const subcategoryId = draft.subcategoryId || lookup.get(subcategoryName.toLowerCase());

      if (!subcategoryId) {
        const categoryName = (draft.category || '').trim();
        if (!categoryName) continue; // can't auto-create or resolve; drop silently like before
        const key = `${categoryName.toLowerCase()}\u0000${subcategoryName.toLowerCase()}`;
        const entry = unresolvedMap.get(key);
        if (entry) entry.quizTitles.push(draft.title);
        else unresolvedMap.set(key, { category: categoryName, subcategory: subcategoryName, quizTitles: [draft.title] });
        continue;
      }

      quizzes.push({
        subcategoryId,
        title: draft.title,
        description: draft.description,
        mode: draft.mode,
        difficulty: draft.difficulty,
        visibility: draft.visibility,
        linkExpiry: draft.linkExpiry,
        customExpiryDate: draft.customExpiryDate,
        timeLimitSeconds: draft.timeLimitSeconds,
        shuffleQuestions: draft.shuffleQuestions,
        shuffleOptions: draft.shuffleOptions,
        antiCheatEnabled: draft.antiCheatEnabled,
        retakePolicy: draft.retakePolicy,
        retakeLimit: draft.retakeLimit,
        pricing: draft.pricing,
        priceKobo: draft.priceKobo,
        allowFlagging: draft.allowFlagging,
        defaultMark: draft.defaultMark,
        showMarks: draft.showMarks,
        questions: draft.questions,
      } satisfies QuizInput);
    }

    setParsedQuizzes(quizzes);
    setWarnings([]);
    const unresolved = Array.from(unresolvedMap.values());
    if (unresolved.length > 0) {
      setPendingJsonDrafts(drafts);
      setUnresolvedSubcategories(unresolved);
    } else {
      setPendingJsonDrafts(null);
      setUnresolvedSubcategories([]);
    }
  }

  /**
   * Creates every unresolved (category, subcategory) pair via the resolve
   * API — reusing an existing category/subcategory by name instead of
   * duplicating it (see getOrCreateCategory/getOrCreateSubcategory) — then
   * re-runs grouping against the now-complete subcategory list so the
   * quizzes that were waiting on them get included without a re-upload.
   */
  async function createUnresolvedSubcategories() {
    if (unresolvedSubcategories.length === 0) return;
    setCreatingSubcategories(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/categories/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: unresolvedSubcategories.map((u) => ({ category: u.category, subcategory: u.subcategory })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to create categories');
        return;
      }
      const lookup = await loadSubcategories();
      setUnresolvedSubcategories([]);
      if (pendingRows) {
        applyRows(pendingRows, lookup);
      } else if (pendingJsonDrafts) {
        applyJsonDrafts(pendingJsonDrafts, lookup);
      }
    } catch {
      setSubmitError('Network error while creating categories. Please try again.');
    } finally {
      setCreatingSubcategories(false);
    }
  }

  /** Builds a downloadable template in whichever of the accepted formats is selected. */
  function downloadTemplate(format: TemplateFormat = templateFormat) {
    if (format === 'csv') {
      downloadBlob(CSV_TEMPLATE, 'cliniolab-bulk-quiz-template.csv', 'text/csv;charset=utf-8');
      return;
    }

    if (format === 'json') {
      downloadBlob(
        JSON.stringify(JSON_TEMPLATE, null, 2),
        'cliniolab-bulk-quiz-template.json',
        'application/json'
      );
      return;
    }

    // xlsx, xls, and ods all go through the same SheetJS workbook, just
    // written out with a different bookType/extension.
    const rows = CSV_TEMPLATE.split('\n').map((line) => parseTemplateLine(line));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = CSV_HEADERS.map((h) =>
      h === 'prompt' || h === 'explanation' || h === 'incorrect_rationale' ? { wch: 40 } : { wch: 16 }
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quiz Upload');

    const bookType = format === 'xls' ? 'biff8' : format === 'ods' ? 'ods' : 'xlsx';
    XLSX.writeFile(workbook, `cliniolab-bulk-quiz-template.${format}`, { bookType });
  }

  function parseTemplateLine(line: string): string[] {
    // The CSV_TEMPLATE constant is already comma-escaped; reuse the same
    // quoted-comma-aware split so the xlsx template gets clean cells.
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    result.push(field);
    return result;
  }

  async function handleSubmit(confirm = false) {
    if (parsedQuizzes.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/quizzes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizzes: parsedQuizzes, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Upload failed');
        return;
      }
      if (data.needsConfirmation) {
        // Duplicates were found and nothing was inserted yet — show the
        // report and let the admin decide whether to proceed anyway.
        setDuplicateReport(data.duplicates);
        return;
      }
      setDuplicateReport(null);
      setSubmittedCount(data.quizzes?.length ?? parsedQuizzes.length);
      setParsedQuizzes([]);
      setFileName(null);
      clearPreviewDraft();
    } catch {
      setSubmitError('Network error while uploading. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to upload quizzes.</p>
        <Button className="mt-6" onClick={() => router.push('/login?next=/quizzes/bulk-upload')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Upload many quizzes</h1>
      <p className="mt-2 text-ink-500">
        Create several quizzes at once from a spreadsheet, instead of building them one by
        one. Download the template, fill it in, upload it — that's it. If you close the tab
        before publishing, your preview is saved and picks back up when you return.
      </p>

      {/* Guided walkthrough */}
      <Card className="mt-8 space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">How it works</h2>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
          <li>
            Download the template below and open it in Excel, Google Sheets, Numbers, or any
            spreadsheet app. Row 1 (the headers) must stay exactly as it is — don't rename,
            reorder, or delete columns.
          </li>
          <li>
            Each row is one <strong>question</strong>. Start your questions on row 2. Give every
            question for the same quiz the exact same{' '}
            <code className="rounded bg-ink-50 px-1">quiz_title</code> (spelled identically,
            including capitalization) — that's how rows get grouped into one quiz.
          </li>
          <li>
            <code className="rounded bg-ink-50 px-1">question_type</code> must be one of{' '}
            <strong>mcq</strong>, <strong>true_false</strong>, or <strong>fill_blank</strong>.
            For <strong>mcq</strong>, fill in <code className="rounded bg-ink-50 px-1">option_1</code>
            {' '}through <code className="rounded bg-ink-50 px-1">option_4</code> and make{' '}
            <code className="rounded bg-ink-50 px-1">correct_answer</code> match one of them{' '}
            <em>exactly</em>, including punctuation and spacing. For{' '}
            <strong>true_false</strong>, leave the option columns blank and set{' '}
            <code className="rounded bg-ink-50 px-1">correct_answer</code> to "True" or "False".
            For <strong>fill_blank</strong>, leave the option columns blank and put the accepted
            text answer in <code className="rounded bg-ink-50 px-1">correct_answer</code>.
          </li>
          <li>
            Set <code className="rounded bg-ink-50 px-1">mode</code> per quiz to{' '}
            <strong>study</strong> (see answers immediately), <strong>quiz</strong>{' '}
            (untimed by default, or timed for speed-drills), or <strong>exam</strong>{' '}
            (always timed, CBT-style). All three are supported in the same upload.
          </li>
          <li>
            Set <code className="rounded bg-ink-50 px-1">time_limit_minutes</code> if you want a
            timer — required for exam mode, optional for quiz mode, ignored for study mode.
          </li>
          <li>
            Fill <code className="rounded bg-ink-50 px-1">subcategory</code> with an existing
            subcategory name from Cliniolab (e.g. "Cardiology", "Exam Prep") if you know it
            already exists. If it doesn&apos;t exist yet, also fill in{' '}
            <code className="rounded bg-ink-50 px-1">category</code> (e.g. "Medicine",
            "Nursing") — you&apos;ll be offered a one-click option to create both before your
            quizzes are published. A subcategory name can safely repeat under different
            categories (e.g. "Basics" under both Cardiology and Respiratory) without creating
            duplicates.
          </li>
          <li>
            <code className="rounded bg-ink-50 px-1">difficulty</code> is optional —{' '}
            <strong>easy</strong>, <strong>medium</strong>, or <strong>hard</strong>. Leave it
            blank and it defaults to medium.{' '}
            <code className="rounded bg-ink-50 px-1">explanation</code> is optional too, and
            shown to the learner after they answer.
          </li>
          <li>
            Save the file and upload it below. You'll get a preview with any problem rows
            called out before anything is published — nothing goes live until you hit Publish.
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <select
            value={templateFormat}
            onChange={(e) => setTemplateFormat(e.target.value as TemplateFormat)}
            className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
            aria-label="Template format"
          >
            {TEMPLATE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => downloadTemplate()}>
            Download template
          </Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Choose file to upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
        <p className="text-xs text-ink-400">
          Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong>, and{' '}
          <strong>.csv</strong> spreadsheets, or <strong>.json</strong> (an array of quiz
          objects, or <code className="rounded bg-ink-50 px-1">{'{ "quizzes": [...] }'}</code>,
          for anyone exporting from another tool).
        </p>
      </Card>

      {fileName && (
        <p className="mt-6 text-sm text-ink-500">
          Selected file: <span className="font-medium text-ink-700">{fileName}</span>
        </p>
      )}

      {unresolvedSubcategories.length > 0 && (
        <Card className="mt-4 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {unresolvedSubcategories.length} new categor{unresolvedSubcategories.length === 1 ? 'y' : 'ies'} in
            this file
          </p>
          <p className="mt-1 text-xs text-ink-600">
            These category/subcategory pairs don&apos;t exist on Cliniolab yet. Create them to include
            the quizzes waiting on them, or fix the file and re-upload if any of these were a typo.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-600">
            {unresolvedSubcategories.map((u, i) => (
              <li key={i}>
                <span className="font-medium text-ink-800">{u.category}</span> {'>'} {u.subcategory}
                {' — '}
                {u.quizTitles.length} quiz{u.quizTitles.length === 1 ? '' : 'zes'} ({u.quizTitles.join(', ')})
              </li>
            ))}
          </ul>
          <Button className="mt-3" size="sm" onClick={createUnresolvedSubcategories} disabled={creatingSubcategories}>
            {creatingSubcategories
              ? 'Creating…'
              : `Create ${unresolvedSubcategories.length} categor${unresolvedSubcategories.length === 1 ? 'y' : 'ies'} & continue`}
          </Button>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="mt-4 border-flag-200 bg-flag-50 p-4">
          <p className="text-sm font-medium text-flag-700">Some rows were skipped</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-flag-700">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {parsedQuizzes.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Preview — {parsedQuizzes.length} quiz{parsedQuizzes.length === 1 ? '' : 'zes'} ready to
            upload
          </h2>
          <div className="mt-4 space-y-3">
            {parsedQuizzes.map((q, i) => {
              const isDuplicateTitle = duplicateReport?.duplicateTitleIndexes.includes(i);
              const duplicateQuestions = duplicateReport?.duplicateQuestionsByQuizIndex[i] ?? [];
              const flagged = isDuplicateTitle || duplicateQuestions.length > 0;
              return (
                <div
                  key={i}
                  className={`rounded-md border p-4 ${
                    flagged ? 'border-flag-300 bg-flag-50' : 'border-ink-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink-800">
                      {q.title}
                      {isDuplicateTitle && (
                        <span className="ml-2 rounded-full bg-flag-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flag-700">
                          Duplicate title
                        </span>
                      )}
                    </p>
                    <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                      {q.mode}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {q.questions.length} question{q.questions.length === 1 ? '' : 's'}
                    {q.timeLimitSeconds ? ` · ${Math.round(q.timeLimitSeconds / 60)} min timer` : ' · no timer'}
                  </p>
                  {duplicateQuestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-flag-700">
                        {duplicateQuestions.length} likely duplicate question
                        {duplicateQuestions.length === 1 ? '' : 's'}:
                      </p>
                      <ul className="ml-4 list-disc space-y-0.5 text-xs text-ink-500">
                        {duplicateQuestions.slice(0, 5).map((dq, di) => (
                          <li key={di}>
                            &ldquo;{dq.prompt.slice(0, 80)}
                            {dq.prompt.length > 80 ? '…' : ''}&rdquo;{' '}
                            <span className="text-ink-400">
                              (
                              {dq.reason === 'already_in_subcategory'
                                ? 'already exists in this subcategory'
                                : 'repeated within this upload'}
                              )
                            </span>
                          </li>
                        ))}
                        {duplicateQuestions.length > 5 && (
                          <li className="text-ink-400">…and {duplicateQuestions.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {duplicateReport && (
            <div className="mt-4 rounded-md border border-flag-300 bg-flag-50 p-4">
              <p className="text-sm font-medium text-flag-700">
                Some quizzes/questions above look like duplicates of content already in these
                subcategories (or repeated within this file). Nothing has been uploaded yet.
                Fix the file and re-upload, or publish anyway if these are intentional.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            {duplicateReport ? (
              <Button onClick={() => handleSubmit(true)} disabled={submitting} variant="secondary">
                {submitting ? 'Publishing…' : 'Publish anyway'}
              </Button>
            ) : (
              <Button onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting ? 'Publishing…' : `Publish ${parsedQuizzes.length} quizzes`}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setParsedQuizzes([]);
                setFileName(null);
                setDuplicateReport(null);
                clearPreviewDraft();
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {submitError && <p className="mt-4 text-sm text-critical-500">{submitError}</p>}

      {submittedCount !== null && (
        <Card className="mt-6 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {submittedCount} quiz{submittedCount === 1 ? '' : 'zes'} published successfully.
          </p>
          <Button className="mt-3" size="sm" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
