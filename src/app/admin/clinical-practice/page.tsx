// File: src/app/admin/clinical-practice/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// ---------------------------------------------------------------------------
// Bulk upload for the Daily Clinical Practice bank (cases, calculations,
// OSCE stations). One kind per upload - pick the tab first, then upload a
// file in that kind's own column layout. Accepts the same file types as
// the Abbreviations bulk upload: .xlsx / .xls / .ods / .csv / .json.
//
// Uploaded rows are ADDED to the existing bank (src/db/migrations/
// 2026-10-add-clinical-practice-items.sql seeds the starter set) - nothing
// is replaced. The bigger the bank gets per kind, the more variety
// "today's 5 cases / 5 calculations / 3 OSCE stations" has to draw from;
// see clinicalPracticeService.getTodaysPracticeSet().
// ---------------------------------------------------------------------------

type Kind = 'case' | 'calculation' | 'osce';

const KIND_LABELS: Record<Kind, string> = { case: 'Clinical cases', calculation: 'Calculations', osce: 'OSCE stations' };

const PAGE_SIZE = 50;

// Admin "existing items" list is cached in localStorage per kind, keyed to
// today's Lagos-local date. First load of the day hits the API; every
// later visit (and every tab switch) on the same day reads the cache
// instead, until a delete/upload invalidates it or the date rolls over.
const EXISTING_CACHE_PREFIX = 'cliniolab_admin_clinical_practice_cache_v1';

interface ExistingItem { id: string; title: string; isActive: boolean; updatedAt: string }
interface ExistingCache { date: string; items: ExistingItem[] }

function todayLagosKey() {
  // Lightweight local-date key; doesn't need to be exact to the minute,
  // just stable within a calendar day for cache invalidation purposes.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function readExistingCache(kind: Kind): ExistingItem[] | null {
  try {
    const raw = localStorage.getItem(`${EXISTING_CACHE_PREFIX}_${kind}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExistingCache;
    if (parsed.date !== todayLagosKey()) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeExistingCache(kind: Kind, items: ExistingItem[]) {
  try {
    const payload: ExistingCache = { date: todayLagosKey(), items };
    localStorage.setItem(`${EXISTING_CACHE_PREFIX}_${kind}`, JSON.stringify(payload));
  } catch {}
}

function clearExistingCache(kind: Kind) {
  try {
    localStorage.removeItem(`${EXISTING_CACHE_PREFIX}_${kind}`);
  } catch {}
}

const CASE_HEADERS = ['title', 'setting', 'prompt', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'feedbackA', 'feedbackB', 'feedbackC', 'feedbackD', 'keyPoint'];
const CALC_HEADERS = ['prompt', 'answer', 'unit', 'tolerance', 'explanation'];
const OSCE_HEADERS = ['title', 'steps'];

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const CASE_CSV_TEMPLATE = [
  CASE_HEADERS.join(','),
  [
    'Chest pain on the ward', 'Medical ward',
    'A patient reports sudden central chest pain radiating to the left arm. What is the priority?',
    'Assess ABCDE, get an ECG and call for urgent help', 'Ask the patient to rest and recheck in an hour',
    'Give oral fluids and reassess at the next round', 'Document the complaint and continue the round',
    'Sudden chest pain needs immediate assessment and escalation; delay risks a missed cardiac event.',
    'Resting without assessment delays recognition of a possible cardiac event.',
    'Fluids do not address a possible cardiac cause.',
    'Documentation matters but must not replace an immediate clinical assessment.',
    'A', 'Treat sudden chest pain as a possible cardiac emergency: ABCDE, ECG, escalate, and stay with the patient.',
  ].map(csvEscape).join(','),
].join('\n');

const CALC_CSV_TEMPLATE = [
  CALC_HEADERS.join(','),
  ['A patient needs 2 g of a drug. Available vials contain 500 mg each. How many vials are required?', '4', 'vials', '0.11', '2000 mg ÷ 500 mg per vial = 4 vials.'].map(csvEscape).join(','),
].join('\n');

const OSCE_CSV_TEMPLATE = [
  OSCE_HEADERS.join(','),
  ['Urinary catheter care', 'Perform hand hygiene and explain the procedure;Confirm identity and obtain consent;Maintain asepsis throughout;Check catheter bag position and drainage;Assess for signs of infection or discomfort;Document findings and care given'].map(csvEscape).join(','),
].join('\n');

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
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  return grid.map((row) => row.map((cell) => (cell ?? '').toString())).filter((r) => r.some((cell) => cell.trim() !== ''));
}

interface CasePreview { title: string; setting: string; prompt: string; options: { label: string; correct: boolean; feedback: string }[]; keyPoint: string }
interface CalcPreview { prompt: string; answer: number; tolerance: number; unit: string; explanation: string }
interface OscePreview { title: string; steps: string[] }
type Preview = CasePreview | CalcPreview | OscePreview;

function rowsToCaseEntries(rows: string[][]): { entries: CasePreview[]; warnings: string[] } {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const col = Object.fromEntries(CASE_HEADERS.map((h) => [h, idx(h)]));
  const warnings: string[] = [];
  const entries: CasePreview[] = [];
  body.forEach((row, i) => {
    const get = (h: string) => (col[h] >= 0 ? (row[col[h]] ?? '').trim() : '');
    const title = get('title');
    const prompt = get('prompt');
    if (!title && !prompt) return;
    const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    const correctLetter = get('correctOption').toUpperCase();
    const options = letters
      .map((L) => ({ label: get(`option${L}`), correct: correctLetter === L, feedback: get(`feedback${L}`) }))
      .filter((o) => o.label);
    if (!title || !prompt || options.length < 2) {
      warnings.push(`Row ${i + 2}: missing title, prompt, or at least 2 options, skipped.`);
      return;
    }
    if (!options.some((o) => o.correct)) {
      warnings.push(`Row ${i + 2}: correctOption "${correctLetter}" doesn't match any filled option, skipped.`);
      return;
    }
    entries.push({ title, setting: get('setting'), prompt, options, keyPoint: get('keyPoint') });
  });
  return { entries, warnings };
}

function rowsToCalcEntries(rows: string[][]): { entries: CalcPreview[]; warnings: string[] } {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const col = Object.fromEntries(CALC_HEADERS.map((h) => [h, idx(h)]));
  const warnings: string[] = [];
  const entries: CalcPreview[] = [];
  body.forEach((row, i) => {
    const get = (h: string) => (col[h] >= 0 ? (row[col[h]] ?? '').trim() : '');
    const prompt = get('prompt');
    const answer = Number(get('answer'));
    if (!prompt && !get('answer')) return;
    if (!prompt || !Number.isFinite(answer)) {
      warnings.push(`Row ${i + 2}: missing prompt or a numeric answer, skipped.`);
      return;
    }
    const toleranceRaw = get('tolerance');
    entries.push({
      prompt,
      answer,
      tolerance: toleranceRaw ? Number(toleranceRaw) || 0.11 : 0.11,
      unit: get('unit'),
      explanation: get('explanation'),
    });
  });
  return { entries, warnings };
}

function rowsToOsceEntries(rows: string[][]): { entries: OscePreview[]; warnings: string[] } {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const col = Object.fromEntries(OSCE_HEADERS.map((h) => [h, idx(h)]));
  const warnings: string[] = [];
  const entries: OscePreview[] = [];
  body.forEach((row, i) => {
    const get = (h: string) => (col[h] >= 0 ? (row[col[h]] ?? '').trim() : '');
    const title = get('title');
    const stepsRaw = get('steps');
    if (!title && !stepsRaw) return;
    const steps = stepsRaw.split(';').map((s) => s.trim()).filter(Boolean);
    if (!title || steps.length < 2) {
      warnings.push(`Row ${i + 2}: missing title or fewer than 2 steps (separate steps with ";"), skipped.`);
      return;
    }
    entries.push({ title, steps });
  });
  return { entries, warnings };
}

export default function ClinicalPracticeAdminPage() {
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<Kind>('case');
  const [fileName, setFileName] = useState<string | null>(null);
  const [entries, setEntries] = useState<Preview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdCount: number; skippedRows: number[] } | null>(null);

  const [existingItems, setExistingItems] = useState<ExistingItem[]>([]);
  const [existingLoading, setExistingLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(0);

  function loadExisting(forKind: Kind, opts: { force?: boolean } = {}) {
    if (!opts.force) {
      const cached = readExistingCache(forKind);
      if (cached) {
        setExistingItems(cached);
        setExistingLoading(false);
        return;
      }
    }
    setExistingLoading(true);
    fetch(`/api/clinical-practice/manage?kind=${forKind}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        const items: ExistingItem[] = data.items ?? [];
        setExistingItems(items);
        writeExistingCache(forKind, items);
      })
      .catch(() => setExistingItems([]))
      .finally(() => setExistingLoading(false));
  }

  useEffect(() => {
    setSelectedIds(new Set());
    setPage(0);
    loadExisting(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const totalPages = Math.max(1, Math.ceil(existingItems.length / PAGE_SIZE));
  const pagedItems = existingItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pagedIds = pagedItems.map((item) => item.id);
  const allOnPageSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pagedIds.forEach((id) => next.delete(id));
      } else {
        pagedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clinical-practice/manage/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Delete failed (status ${res.status}).`);
      }
      const nextItems = existingItems.filter((item) => item.id !== id);
      setExistingItems(nextItems);
      writeExistingCache(kind, nextItems);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected ${KIND_LABELS[kind].toLowerCase()}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/clinical-practice/manage/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Bulk delete failed (status ${res.status}).`);
      }
      const deleted = new Set(ids);
      const nextItems = existingItems.filter((item) => !deleted.has(item.id));
      setExistingItems(nextItems);
      writeExistingCache(kind, nextItems);
      setSelectedIds(new Set());
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Bulk delete failed.');
    } finally {
      setBulkDeleting(false);
    }
  }

  function resetUpload() {
    setFileName(null);
    setEntries([]);
    setWarnings([]);
    setSubmitError(null);
    setResult(null);
  }

  function switchKind(next: Kind) {
    setKind(next);
    resetUpload();
  }

  async function handleFile(file: File) {
    setSubmitError(null);
    setResult(null);
    setFileName(file.name);
    const lowerName = file.name.toLowerCase();

    try {
      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const drafts: Record<string, unknown>[] = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(drafts)) throw new Error('JSON must be an array or { "entries": [...] }');

        if (kind === 'case') {
          const cleaned = drafts
            .map((d) => ({
              title: String(d.title ?? '').trim(),
              setting: String(d.setting ?? '').trim(),
              prompt: String(d.prompt ?? '').trim(),
              options: Array.isArray(d.options)
                ? (d.options as Record<string, unknown>[]).map((o) => ({
                    label: String(o.label ?? '').trim(),
                    correct: o.correct === true,
                    feedback: String(o.feedback ?? '').trim(),
                  }))
                : [],
              keyPoint: String(d.keyPoint ?? '').trim(),
            }))
            .filter((e) => e.title && e.prompt && e.options.length >= 2 && e.options.some((o) => o.correct));
          setEntries(cleaned);
        } else if (kind === 'calculation') {
          const cleaned = drafts
            .map((d) => ({
              prompt: String(d.prompt ?? '').trim(),
              answer: Number(d.answer),
              tolerance: d.tolerance !== undefined ? Number(d.tolerance) : 0.11,
              unit: String(d.unit ?? '').trim(),
              explanation: String(d.explanation ?? '').trim(),
            }))
            .filter((e) => e.prompt && Number.isFinite(e.answer));
          setEntries(cleaned);
        } else {
          const cleaned = drafts
            .map((d) => ({
              title: String(d.title ?? '').trim(),
              steps: Array.isArray(d.steps) ? (d.steps as unknown[]).map((s) => String(s).trim()).filter(Boolean) : [],
            }))
            .filter((e) => e.title && e.steps.length >= 2);
          setEntries(cleaned);
        }
        setWarnings([]);
      } else {
        const rows = await parseSpreadsheet(file);
        if (rows.length < 2) throw new Error('No data rows found. Row 1 must be the column headers, with entries starting on row 2.');
        const { entries: parsed, warnings: w } =
          kind === 'case' ? rowsToCaseEntries(rows) : kind === 'calculation' ? rowsToCalcEntries(rows) : rowsToOsceEntries(rows);
        setEntries(parsed);
        setWarnings(w);
      }
    } catch (err) {
      setEntries([]);
      setSubmitError(err instanceof Error ? err.message : 'Could not parse file.');
    }
  }

  function downloadTemplate() {
    const template = kind === 'case' ? CASE_CSV_TEMPLATE : kind === 'calculation' ? CALC_CSV_TEMPLATE : OSCE_CSV_TEMPLATE;
    downloadBlob(template, `cliniolab-clinical-practice-${kind}-template.csv`, 'text/csv;charset=utf-8');
  }

  async function handleSubmit() {
    if (entries.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    let res: Response;
    try {
      res = await fetch('/api/clinical-practice/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, entries }),
      });
    } catch {
      setSubmitError('Network error while uploading. Please try again.');
      setSubmitting(false);
      return;
    }

    let data: { createdCount?: number; skippedRows?: number[]; error?: string } = {};
    try {
      data = await res.json();
    } catch {
      setSubmitError(`Upload failed (status ${res.status}). Please try again or contact support.`);
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      setSubmitError(data.error ?? `Upload failed (status ${res.status}).`);
      setSubmitting(false);
      return;
    }

    setResult({ createdCount: data.createdCount ?? 0, skippedRows: data.skippedRows ?? [] });
    setEntries([]);
    setFileName(null);
    setSubmitting(false);
    clearExistingCache(kind);
    loadExisting(kind, { force: true });
  }

  if (loading) return null;
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Admin access required</h1>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Daily Clinical Practice: bulk upload</h1>
      <p className="mt-2 text-ink-500">
        Add clinical cases, calculations or OSCE stations to the practice bank from a spreadsheet. Uploaded rows are
        added to the existing bank - each day, a set is picked automatically from everything here.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-ink-100">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => switchKind(k)}
            aria-pressed={kind === k}
            className={`px-2 py-3 text-xs font-semibold transition sm:text-sm ${kind === k ? 'bg-white text-pulse-700' : 'bg-ink-50 text-ink-500 hover:bg-white'}`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <Card className="mt-4 space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">How it works - {KIND_LABELS[kind]}</h2>
        {kind === 'case' && (
          <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
            <li>Download the template below. Row 1 (headers) must stay as-is.</li>
            <li>One row per case: <code className="rounded bg-ink-50 px-1">title</code>, <code className="rounded bg-ink-50 px-1">setting</code>, <code className="rounded bg-ink-50 px-1">prompt</code> are the scenario.</li>
            <li>Up to 4 options: <code className="rounded bg-ink-50 px-1">optionA</code>&ndash;<code className="rounded bg-ink-50 px-1">optionD</code> (at least 2 required), each with its own <code className="rounded bg-ink-50 px-1">feedbackA</code>&ndash;<code className="rounded bg-ink-50 px-1">feedbackD</code>.</li>
            <li><code className="rounded bg-ink-50 px-1">correctOption</code> is the letter (A/B/C/D) of the right answer. <code className="rounded bg-ink-50 px-1">keyPoint</code> is the takeaway shown after answering.</li>
          </ol>
        )}
        {kind === 'calculation' && (
          <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
            <li>Download the template below. Row 1 (headers) must stay as-is.</li>
            <li>One row per calculation: <code className="rounded bg-ink-50 px-1">prompt</code>, numeric <code className="rounded bg-ink-50 px-1">answer</code>, <code className="rounded bg-ink-50 px-1">unit</code> (e.g. &ldquo;mL/hour&rdquo;) are required.</li>
            <li><code className="rounded bg-ink-50 px-1">tolerance</code> is optional (defaults to 0.11, i.e. nearest whole number). <code className="rounded bg-ink-50 px-1">explanation</code> is shown after the learner answers.</li>
          </ol>
        )}
        {kind === 'osce' && (
          <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
            <li>Download the template below. Row 1 (headers) must stay as-is.</li>
            <li>One row per station: <code className="rounded bg-ink-50 px-1">title</code> and <code className="rounded bg-ink-50 px-1">steps</code> (at least 2 steps).</li>
            <li>In the CSV/spreadsheet, separate steps with a semicolon (<code className="rounded bg-ink-50 px-1">;</code>) within the one cell. In JSON, <code className="rounded bg-ink-50 px-1">steps</code> is an array of strings.</li>
          </ol>
        )}
        <p className="text-sm text-ink-600">Duplicate rows aren&rsquo;t detected across kinds, only matching ids are skipped, so check the preview before uploading.</p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="secondary" onClick={downloadTemplate}>Download {kind} template (.csv)</Button>
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
          Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong>, and <strong>.csv</strong> spreadsheets, or{' '}
          <strong>.json</strong> (an array of entry objects, or <code className="rounded bg-ink-50 px-1">{'{ "entries": [...] }'}</code>) in the same shape as the template, with your own content.
        </p>
      </Card>

      {fileName && (
        <p className="mt-6 text-sm text-ink-500">
          Selected file: <span className="font-medium text-ink-700">{fileName}</span>
        </p>
      )}

      {warnings.length > 0 && (
        <Card className="mt-4 border-flag-200 bg-flag-50 p-4">
          <p className="text-sm font-medium text-flag-700">Some rows were skipped</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-flag-700">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Card>
      )}

      {entries.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Preview - {entries.length} {KIND_LABELS[kind].toLowerCase()} ready to upload
          </h2>
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {entries.map((e, i) => (
              <div key={i} className="rounded-md border border-ink-100 p-3 text-sm text-ink-700">
                {'title' in e ? <p className="font-semibold">{e.title}</p> : <p className="font-semibold">{(e as CalcPreview).prompt}</p>}
                {'prompt' in e && 'title' in e && <p className="mt-1 text-ink-500">{e.prompt}</p>}
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading…' : `Upload ${entries.length} ${KIND_LABELS[kind].toLowerCase()}`}
            </Button>
            <Button variant="secondary" onClick={resetUpload}>Cancel</Button>
          </div>
        </Card>
      )}

      {submitError && <p className="mt-4 text-sm text-critical-500">{submitError}</p>}

      {result && (
        <Card className="mt-6 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {result.createdCount} {KIND_LABELS[kind].toLowerCase()} added to the bank.
          </p>
          {result.skippedRows.length > 0 && (
            <p className="mt-2 text-xs text-ink-500">Rows skipped as invalid: {result.skippedRows.join(', ')}</p>
          )}
        </Card>
      )}

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-800">
              Existing {KIND_LABELS[kind].toLowerCase()} in the bank
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Delete items to remove them from the pool future daily sets are picked from. Items currently shown in
              today&rsquo;s set stay visible to anyone already on the page until they reload.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearExistingCache(kind);
              loadExisting(kind, { force: true });
            }}
            disabled={existingLoading}
          >
            Refresh list
          </Button>
        </div>
        {deleteError && <p className="mt-2 text-sm text-critical-500">{deleteError}</p>}
        {existingLoading ? (
          <p className="mt-4 text-sm text-ink-400">Loading…</p>
        ) : existingItems.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No {KIND_LABELS[kind].toLowerCase()} in the bank yet.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                Select all on this page
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-400">{selectedIds.size} selected</span>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={selectedIds.size === 0 || bulkDeleting}
                  onClick={handleBulkDelete}
                >
                  {bulkDeleting ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
                </Button>
              </div>
            </div>
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
              {pagedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-ink-100 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`Select ${item.title}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-700">{item.title}</p>
                      <p className="text-xs text-ink-400">{item.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deletingId === item.id || bulkDeleting}
                    onClick={() => handleDelete(item.id, item.title)}
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <span className="text-xs text-ink-400">
                  Page {page + 1} of {totalPages} &middot; {existingItems.length} total
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
