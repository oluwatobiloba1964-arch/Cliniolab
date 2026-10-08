// src/app/flashcards/bulk-upload/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { FlashcardInput } from '@/types';

// ---------------------------------------------------------------------------
// Sheet shape: one row per CARD. Rows sharing the same set_title are
// grouped into a single flashcard set, same pattern as the quiz bulk
// upload (one row per question there).
//
// Columns: set_title, category, subcategory, visibility, pricing,
//          price_naira, front, back, explanation
// - visibility: public | private (defaults to public)
// - pricing: free | paid (defaults to free)
// - price_naira: required if pricing is "paid"
// - category: only needed if "subcategory" doesn't already exist.
// ---------------------------------------------------------------------------

const HEADERS = [
  'set_title',
  'category',
  'subcategory',
  'visibility',
  'pricing',
  'price_naira',
  'front',
  'back',
  'explanation',
];

const CSV_TEMPLATE = [
  HEADERS.join(','),
  [
    'Cardiac Terms', 'Medicine', 'Cardiology', 'public', 'free', '',
    'Bradycardia', 'Heart rate below 60 bpm', 'Common causes include beta-blockers and athletic conditioning.',
  ].map(csvEscape).join(','),
  [
    'Cardiac Terms', 'Medicine', 'Cardiology', 'public', 'free', '',
    'Tachycardia', 'Heart rate above 100 bpm', '',
  ].map(csvEscape).join(','),
  [
    'NCLEX Pharmacology Deck', 'Nursing', 'Exam Prep', 'public', 'paid', '500',
    'Digoxin therapeutic range', '0.5-2.0 ng/mL', 'Toxicity risk increases with hypokalemia.',
  ].map(csvEscape).join(','),
].join('\n');

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const JSON_TEMPLATE = {
  flashcardSets: [
    {
      title: 'Cardiac Terms',
      category: 'Medicine',
      subcategory: 'Cardiology',
      visibility: 'public',
      pricing: 'free',
      cards: [
        { front: 'Bradycardia', back: 'Heart rate below 60 bpm', explanation: 'Common causes include beta-blockers and athletic conditioning.' },
        { front: 'Tachycardia', back: 'Heart rate above 100 bpm' },
      ],
    },
    {
      title: 'NCLEX Pharmacology Deck',
      category: 'Nursing',
      subcategory: 'Exam Prep',
      visibility: 'public',
      pricing: 'paid',
      priceNaira: 500,
      cards: [
        { front: 'Digoxin therapeutic range', back: '0.5-2.0 ng/mL', explanation: 'Toxicity risk increases with hypokalemia.' },
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

function validateHeaders(header: string[]): string[] {
  const warnings: string[] = [];
  const normalized = header.map((h) => h.trim().toLowerCase());
  const required = ['set_title', 'subcategory', 'front', 'back'];
  for (const col of required) {
    if (!normalized.includes(col)) {
      warnings.push(`Missing required column "${col}". Add it as a header in row 1.`);
    }
  }
  const known = new Set<string>(HEADERS);
  const unknown = header.filter((h) => h.trim() && !known.has(h.trim().toLowerCase()));
  if (unknown.length > 0) {
    warnings.push(
      `Unrecognized column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Check for typos - these will be ignored.`
    );
  }
  return warnings;
}

/**
 * Groups flat rows into per-set FlashcardInput objects, in first-seen
 * order. A set whose subcategory isn't recognized is held back and
 * reported in unresolvedSubcategories, mirroring the quiz bulk upload's
 * "create then continue" flow.
 */
function rowsToFlashcardInputs(
  rows: string[][],
  subcategoryLookup: Map<string, string>
): {
  sets: FlashcardInput[];
  warnings: string[];
  unresolvedSubcategories: { category: string; subcategory: string; setTitles: string[] }[];
} {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const warnings: string[] = validateHeaders(header);

  const colIndex: Record<string, number> = {};
  for (const h of HEADERS) colIndex[h] = idx(h);

  const grouped = new Map<string, { meta: Record<string, string>; rows: Record<string, string>[] }>();

  body.forEach((row, i) => {
    const cols: Record<string, string> = {};
    for (const h of HEADERS) {
      const at = colIndex[h];
      cols[h] = at >= 0 ? (row[at] ?? '') : '';
    }
    const title = cols.set_title.trim();
    if (!title) {
      warnings.push(`Row ${i + 2}: missing set_title, skipped.`);
      return;
    }
    if (!cols.front.trim() || !cols.back.trim()) {
      warnings.push(`Row ${i + 2} ("${title}"): missing front or back, skipped.`);
      return;
    }
    if (!grouped.has(title)) grouped.set(title, { meta: cols, rows: [] });
    grouped.get(title)!.rows.push(cols);
  });

  const sets: FlashcardInput[] = [];
  const unresolvedMap = new Map<string, { category: string; subcategory: string; setTitles: string[] }>();

  for (const [title, { meta, rows: cardRows }] of grouped) {
    const subcategoryName = meta.subcategory.trim();
    const subcategoryId = subcategoryLookup.get(subcategoryName.toLowerCase());

    if (!subcategoryId) {
      const categoryName = meta.category.trim();
      if (!categoryName) {
        warnings.push(
          `Set "${title}": subcategory "${subcategoryName}" not recognized, and no "category" column value was given to create it under. Skipped.`
        );
        continue;
      }
      const key = `${categoryName.toLowerCase()}\u0000${subcategoryName.toLowerCase()}`;
      const entry = unresolvedMap.get(key);
      if (entry) entry.setTitles.push(title);
      else unresolvedMap.set(key, { category: categoryName, subcategory: subcategoryName, setTitles: [title] });
      continue;
    }

    const pricing = (meta.pricing.trim().toLowerCase() || 'free') as 'free' | 'paid';
    const visibility = (meta.visibility.trim().toLowerCase() || 'public') as 'public' | 'private';
    const priceNaira = meta.price_naira.trim() ? Number(meta.price_naira.trim()) : undefined;

    if (!['free', 'paid'].includes(pricing)) {
      warnings.push(`Set "${title}": invalid pricing "${meta.pricing}", skipped.`);
      continue;
    }
    if (!['public', 'private'].includes(visibility)) {
      warnings.push(`Set "${title}": invalid visibility "${meta.visibility}", skipped.`);
      continue;
    }
    if (pricing === 'paid' && (!priceNaira || !Number.isFinite(priceNaira ?? NaN) || priceNaira <= 0)) {
      warnings.push(`Set "${title}": pricing is "paid" but price_naira is missing or invalid, skipped.`);
      continue;
    }

    sets.push({
      subcategoryId,
      title,
      visibility,
      pricing,
      priceKobo: pricing === 'paid' && priceNaira ? Math.round(priceNaira * 100) : undefined,
      cards: cardRows.map((r) => ({
        front: r.front.trim(),
        back: r.back.trim(),
        explanation: r.explanation?.trim() || undefined,
      })),
    });
  }

  return { sets, warnings, unresolvedSubcategories: Array.from(unresolvedMap.values()) };
}

type JsonSetDraft = Omit<FlashcardInput, 'subcategoryId'> & {
  category?: string;
  subcategory: string;
  subcategoryId?: string;
  priceNaira?: number;
};

export default function FlashcardBulkUploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedSets, setParsedSets] = useState<FlashcardInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<{ name: string; id: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('xlsx');

  const [pendingRows, setPendingRows] = useState<string[][] | null>(null);
  const [pendingJsonDrafts, setPendingJsonDrafts] = useState<JsonSetDraft[] | null>(null);
  const [unresolvedSubcategories, setUnresolvedSubcategories] = useState<
    { category: string; subcategory: string; setTitles: string[] }[]
  >([]);
  const [creatingSubcategories, setCreatingSubcategories] = useState(false);

  const subcategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subcategoryOptions) map.set(s.name.toLowerCase(), s.id);
    return map;
  }, [subcategoryOptions]);

  async function loadSubcategories(): Promise<Map<string, string>> {
    const res = await fetch('/api/categories');
    const data = await res.json();
    const options = (data.subcategories ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
    setSubcategoryOptions(options);
    const map = new Map<string, string>();
    for (const s of options) map.set(s.name.toLowerCase(), s.id);
    return map;
  }

  async function ensureSubcategoriesLoaded() {
    if (subcategoryOptions.length > 0) return subcategoryLookup;
    return loadSubcategories();
  }

  function downloadTemplate() {
    if (templateFormat === 'csv') {
      downloadBlob(CSV_TEMPLATE, 'flashcards-template.csv', 'text/csv');
      return;
    }
    if (templateFormat === 'json') {
      downloadBlob(JSON.stringify(JSON_TEMPLATE, null, 2), 'flashcards-template.json', 'application/json');
      return;
    }
    const rows = CSV_TEMPLATE.split('\n').map((line) =>
      line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? []
    );
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flashcards');
    XLSX.writeFile(wb, `flashcards-template.${templateFormat}`);
  }

  function jsonDraftsToInputs(drafts: JsonSetDraft[], lookup: Map<string, string>) {
    const sets: FlashcardInput[] = [];
    const warns: string[] = [];
    const unresolvedMap = new Map<string, { category: string; subcategory: string; setTitles: string[] }>();

    for (const draft of drafts) {
      const title = (draft.title ?? '').trim();
      const subcategoryName = (draft.subcategory ?? '').trim();
      const subId = draft.subcategoryId || lookup.get(subcategoryName.toLowerCase());
      if (!title) {
        warns.push('A flashcard set is missing a title and was skipped.');
        continue;
      }
      if (!subId) {
        const cat = (draft.category ?? '').trim();
        if (!cat || !subcategoryName) {
          warns.push(`Set "${title}": subcategory is missing or not recognized, and no category was given. Skipped.`);
          continue;
        }
        const key = `${cat.toLowerCase()}\u0000${subcategoryName.toLowerCase()}`;
        const entry = unresolvedMap.get(key);
        if (entry) entry.setTitles.push(title);
        else unresolvedMap.set(key, { category: cat, subcategory: subcategoryName, setTitles: [title] });
        continue;
      }
      if (!Array.isArray(draft.cards) || draft.cards.length === 0) {
        warns.push(`Set "${title}": no cards, skipped.`);
        continue;
      }

      const visibility = (draft.visibility ?? 'public') as 'public' | 'private';
      const pricing = (draft.pricing ?? 'free') as 'free' | 'paid';
      if (!['public', 'private'].includes(visibility)) {
        warns.push(`Set "${title}": invalid visibility, skipped.`);
        continue;
      }
      if (!['free', 'paid'].includes(pricing)) {
        warns.push(`Set "${title}": invalid pricing, skipped.`);
        continue;
      }
      const priceNaira = draft.priceNaira;
      if (pricing === 'paid' && (!Number.isFinite(priceNaira ?? NaN) || (priceNaira ?? 0) <= 0)) {
        warns.push(`Set "${title}": paid sets require a positive priceNaira, skipped.`);
        continue;
      }

      const cards = draft.cards.map((card, index) => ({
        front: String(card?.front ?? '').trim(),
        back: String(card?.back ?? '').trim(),
        explanation: card?.explanation ? String(card.explanation).trim() || undefined : undefined,
        index,
      }));
      const invalidCard = cards.find((card) => !card.front || !card.back);
      if (invalidCard) {
        warns.push(`Set "${title}": card ${invalidCard.index + 1} is missing a front or back, skipped.`);
        continue;
      }

      sets.push({
        subcategoryId: subId,
        title,
        description: draft.description,
        visibility,
        pricing,
        priceKobo: pricing === 'paid' ? Math.round((priceNaira as number) * 100) : undefined,
        shuffleCards: draft.shuffleCards,
        cards: cards.map(({ index: _index, ...card }) => card),
      });
    }
    return { sets, warns, unresolved: Array.from(unresolvedMap.values()) };
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setSubmittedCount(null);
    setSubmitError(null);
    setParsedSets([]);
    setWarnings([]);
    setUnresolvedSubcategories([]);
    setPendingRows(null);
    setPendingJsonDrafts(null);

    const lookup = await ensureSubcategoriesLoaded();

    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const drafts: JsonSetDraft[] = Array.isArray(parsed) ? parsed : parsed.flashcardSets ?? [];
        const { sets, warns, unresolved } = jsonDraftsToInputs(drafts, lookup);
        if (unresolved.length > 0) {
          setPendingJsonDrafts(drafts);
          setUnresolvedSubcategories(unresolved);
        }
        setParsedSets(sets);
        setWarnings(warns);
      } catch {
        setWarnings(['Could not parse this JSON file. Check it is valid JSON matching the template shape.']);
      }
      return;
    }

    const rows = await parseSpreadsheet(file);
    if (rows.length < 2) {
      setWarnings(['File has no data rows below the header.']);
      return;
    }
    const { sets, warnings: warns, unresolvedSubcategories: unresolved } = rowsToFlashcardInputs(rows, lookup);
    if (unresolved.length > 0) {
      setPendingRows(rows);
      setUnresolvedSubcategories(unresolved);
    }
    setParsedSets(sets);
    setWarnings(warns);
  }

  async function createUnresolvedSubcategories() {
    setCreatingSubcategories(true);
    try {
      const res = await fetch('/api/categories/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: unresolvedSubcategories.map((u) => ({ category: u.category, subcategory: u.subcategory })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error ?? 'Failed to create one or more categories.');
        return;
      }

      const lookup = await loadSubcategories();
      setUnresolvedSubcategories([]);

      if (pendingRows) {
        const { sets, warnings: warns } = rowsToFlashcardInputs(pendingRows, lookup);
        setParsedSets(sets);
        setWarnings(warns);
        setPendingRows(null);
      } else if (pendingJsonDrafts) {
        const { sets, warns } = jsonDraftsToInputs(pendingJsonDrafts, lookup);
        setParsedSets(sets);
        setWarnings(warns);
        setPendingJsonDrafts(null);
      }
    } catch {
      setSubmitError('Failed to create one or more categories. Try again.');
    } finally {
      setCreatingSubcategories(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    let successCount = 0;
    const failures: string[] = [];
    try {
      for (const set of parsedSets) {
        const res = await fetch('/api/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(set),
        });
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          failures.push(`"${set.title}": ${data.error ?? `HTTP ${res.status}`}`);
        }
      }
      setSubmittedCount(successCount);
      setParsedSets([]);
      setFileName(null);
      if (failures.length > 0) {
        setSubmitError(`${failures.length} set(s) failed to upload:\n${failures.join('\n')}`);
      }
    } catch {
      setSubmitError('Network error while publishing.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadSubcategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to bulk-upload flashcards.</p>
        <Button className="mt-6" onClick={() => router.push('/login?next=/flashcards/bulk-upload')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Bulk upload flashcards</h1>
      <p className="mt-2 text-sm text-ink-500">
        Upload a spreadsheet or JSON file with one row per card. Rows sharing the same{' '}
        <code className="rounded bg-ink-50 px-1">set_title</code> are grouped into one flashcard set.
      </p>

      <Card className="mt-8 space-y-3 p-6">
        <p className="text-sm font-medium text-ink-700">1. Get the template</p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <select
            value={templateFormat}
            onChange={(e) => setTemplateFormat(e.target.value as TemplateFormat)}
            className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
            aria-label="Template format"
          >
            {TEMPLATE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={downloadTemplate}>Download template</Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>Choose file to upload</Button>
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
          <strong>.csv</strong> spreadsheets, or <strong>.json</strong> (an array of set objects, or{' '}
          <code className="rounded bg-ink-50 px-1">{'{ "flashcardSets": [...] }'}</code>).
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
            {unresolvedSubcategories.length} new categor{unresolvedSubcategories.length === 1 ? 'y' : 'ies'} in this file
          </p>
          <p className="mt-1 text-xs text-ink-600">
            Create them to include the flashcard sets waiting on them, or fix the file and re-upload if any were a typo.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-600">
            {unresolvedSubcategories.map((u, i) => (
              <li key={i}>
                <span className="font-medium text-ink-800">{u.category}</span> {'>'} {u.subcategory}
                {' - '}
                {u.setTitles.length} set{u.setTitles.length === 1 ? '' : 's'} ({u.setTitles.join(', ')})
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
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Card>
      )}

      {parsedSets.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Preview - {parsedSets.length} flashcard set{parsedSets.length === 1 ? '' : 's'} ready to upload
          </h2>
          <div className="mt-4 space-y-3">
            {parsedSets.map((s, i) => (
              <div key={i} className="rounded-md border border-ink-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink-800">{s.title}</p>
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                    {s.pricing === 'paid' ? `₦${((s.priceKobo ?? 0) / 100).toLocaleString('en-NG')}` : 'Free'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {s.cards.length} card{s.cards.length === 1 ? '' : 's'} · {s.visibility}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Publishing…' : `Publish ${parsedSets.length} flashcard set${parsedSets.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="secondary" onClick={() => { setParsedSets([]); setFileName(null); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {submitError && <p className="mt-4 whitespace-pre-line text-sm text-critical-500">{submitError}</p>}

      {submittedCount !== null && (
        <Card className="mt-6 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {submittedCount} flashcard set{submittedCount === 1 ? '' : 's'} published successfully.
          </p>
          <Button className="mt-3" size="sm" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
        </Card>
      )}
    </div>
  );
}
