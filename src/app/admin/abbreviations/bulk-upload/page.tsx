'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { normalizeForDedup } from '@/lib/utils/normalizeText';

// ---------------------------------------------------------------------------
// Sheet/CSV shape: one row per entry — either a short abbreviation
// (e.g. "NPO") or a full glossary term (e.g. "Homeostasis").
//
// Columns: term, meaning, category, type
// - term and meaning are required. ("abbreviation" is also accepted as a
//   header alias for "term", since that's what the column has always been
//   called.)
// - category is optional.
// - type is optional: "abbreviation" or "glossary". If left blank, the
//   "Default type for rows without one" picker below decides it — so a
//   whole file of one kind doesn't need the column at all, but a mixed
//   file can still tag rows individually.
// ---------------------------------------------------------------------------

const HEADERS = ['term', 'meaning', 'category', 'type'];
const TERM_HEADER_ALIASES = ['term', 'abbreviation'];

const CSV_TEMPLATE = [
  HEADERS.join(','),
  ['NPO', 'Nil per os (nothing by mouth)', 'General Clinical', 'abbreviation'].map(csvEscape).join(','),
  ['BID', 'Twice a day (bis in die)', 'Pharmacology', 'abbreviation'].map(csvEscape).join(','),
  [
    'Homeostasis',
    'The body\u2019s tendency to maintain a stable, balanced internal environment despite external changes',
    'Physiology',
    'glossary',
  ]
    .map(csvEscape)
    .join(','),
  ['STAT', 'Immediately', '', 'abbreviation'].map(csvEscape).join(','),
].join('\n');

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const JSON_TEMPLATE = {
  entries: [
    { term: 'NPO', meaning: 'Nil per os (nothing by mouth)', category: 'General Clinical', type: 'abbreviation' },
    { term: 'BID', meaning: 'Twice a day (bis in die)', category: 'Pharmacology', type: 'abbreviation' },
    {
      term: 'Homeostasis',
      meaning: 'The body\u2019s tendency to maintain a stable, balanced internal environment despite external changes',
      category: 'Physiology',
      type: 'glossary',
    },
    { term: 'STAT', meaning: 'Immediately', type: 'abbreviation' },
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

/** Reads any supported spreadsheet (xlsx, xls, ods, csv) with SheetJS into a plain grid of strings. */
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

function parseTemplateLine(line: string): string[] {
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

interface AbbreviationEntry {
  abbreviation: string;
  meaning: string;
  category?: string;
  isGlossary: boolean;
}

interface RowResult {
  entries: AbbreviationEntry[];
  warnings: string[];
}

function validateHeaders(header: string[]): string[] {
  const warnings: string[] = [];
  const normalized = header.map((h) => h.trim().toLowerCase());
  if (!TERM_HEADER_ALIASES.some((alias) => normalized.includes(alias))) {
    warnings.push('Missing required column "term" (or "abbreviation"). Add it as a header in row 1.');
  }
  if (!normalized.includes('meaning')) {
    warnings.push('Missing required column "meaning". Add it as a header in row 1.');
  }
  const known = new Set([...HEADERS, ...TERM_HEADER_ALIASES]);
  const unknown = header.filter((h) => h.trim() && !known.has(h.trim().toLowerCase()));
  if (unknown.length > 0) {
    warnings.push(
      `Unrecognized column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Check for typos. These will be ignored.`
    );
  }
  return warnings;
}

function parseTypeCell(raw: string, defaultIsGlossary: boolean): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return defaultIsGlossary;
  if (v === 'glossary' || v === 'term' || v === 'glossary term') return true;
  return false; // 'abbreviation' or anything unrecognized falls back to abbreviation
}

function rowsToEntries(rows: string[][], defaultIsGlossary: boolean): RowResult {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const warnings = validateHeaders(header);

  const termIdx = TERM_HEADER_ALIASES.map(idx).find((i) => i >= 0) ?? -1;
  const meaningIdx = idx('meaning');
  const categoryIdx = idx('category');
  const typeIdx = idx('type');

  const entries: AbbreviationEntry[] = [];
  const seenInFile = new Set<string>();

  body.forEach((row, i) => {
    const term = termIdx >= 0 ? (row[termIdx] ?? '').trim() : '';
    const meaning = meaningIdx >= 0 ? (row[meaningIdx] ?? '').trim() : '';
    const category = categoryIdx >= 0 ? (row[categoryIdx] ?? '').trim() : '';
    const typeCell = typeIdx >= 0 ? (row[typeIdx] ?? '').trim() : '';
    const isGlossary = parseTypeCell(typeCell, defaultIsGlossary);

    if (!term && !meaning) return; // blank row, ignore silently

    if (!term || !meaning) {
      warnings.push(`Row ${i + 2}: missing ${!term ? 'term' : 'meaning'}, skipped.`);
      return;
    }

    // Normalized key catches punctuation/whitespace-only variants too
    // (e.g. "ACE Inhibitor" vs "ACE-Inhibitor"), not just exact matches.
    const key = `${isGlossary ? 'g' : 'a'}:${normalizeForDedup(term)}`;
    if (seenInFile.has(key)) {
      warnings.push(`Row ${i + 2}: "${term}" is a duplicate within this file, skipped.`);
      return;
    }
    seenInFile.add(key);

    entries.push({ abbreviation: term, meaning, category: category || undefined, isGlossary });
  });

  return { entries, warnings };
}

export default function AbbreviationsBulkUploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [entries, setEntries] = useState<AbbreviationEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    createdCount: number;
    skipped: { term: string; reason: 'already_in_database' | 'duplicate_in_file' }[];
  } | null>(null);
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('xlsx');
  const [defaultIsGlossary, setDefaultIsGlossary] = useState(false);

  async function handleFile(file: File) {
    setSubmitError(null);
    setResult(null);
    setFileName(file.name);
    const lowerName = file.name.toLowerCase();

    try {
      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const drafts: Record<string, unknown>[] = Array.isArray(data) ? data : data.entries ?? data.abbreviations;
        if (!Array.isArray(drafts)) {
          throw new Error('JSON must be an array or { "entries": [...] }');
        }

        const seen = new Set<string>();
        const cleaned: AbbreviationEntry[] = [];
        const w: string[] = [];
        drafts.forEach((d, i) => {
          const term = ((d.term ?? d.abbreviation) ?? '').toString().trim();
          const meaning = (d.meaning ?? '').toString().trim();
          const category = d.category ? d.category.toString().trim() : undefined;
          const isGlossary = parseTypeCell((d.type ?? '').toString(), defaultIsGlossary);
          if (!term || !meaning) {
            w.push(`Entry ${i + 1}: missing term or meaning, skipped.`);
            return;
          }
          const key = `${isGlossary ? 'g' : 'a'}:${normalizeForDedup(term)}`;
          if (seen.has(key)) {
            w.push(`Entry ${i + 1}: "${term}" is a duplicate within this file, skipped.`);
            return;
          }
          seen.add(key);
          cleaned.push({ abbreviation: term, meaning, category, isGlossary });
        });
        setEntries(cleaned);
        setWarnings(w);
      } else {
        const rows = await parseSpreadsheet(file);
        if (rows.length < 2) {
          throw new Error(
            'No data rows found. Row 1 must be the column headers, with your entries starting on row 2.'
          );
        }
        const { entries: parsed, warnings: w } = rowsToEntries(rows, defaultIsGlossary);
        setEntries(parsed);
        setWarnings(w);
      }
    } catch (err) {
      setEntries([]);
      setSubmitError(err instanceof Error ? err.message : 'Could not parse file.');
    }
  }

  function downloadTemplate(format: TemplateFormat = templateFormat) {
    if (format === 'csv') {
      downloadBlob(CSV_TEMPLATE, 'cliniolab-bulk-abbreviations-template.csv', 'text/csv;charset=utf-8');
      return;
    }
    if (format === 'json') {
      downloadBlob(
        JSON.stringify(JSON_TEMPLATE, null, 2),
        'cliniolab-bulk-abbreviations-template.json',
        'application/json'
      );
      return;
    }
    const rows = CSV_TEMPLATE.split('\n').map((line) => parseTemplateLine(line));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = HEADERS.map((h) => (h === 'meaning' ? { wch: 40 } : { wch: 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Abbreviations Upload');
    const bookType = format === 'xls' ? 'biff8' : format === 'ods' ? 'ods' : 'xlsx';
    XLSX.writeFile(workbook, `cliniolab-bulk-abbreviations-template.${format}`, { bookType });
  }

  async function handleSubmit() {
    if (entries.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    let res: Response;
    try {
      res = await fetch('/api/abbreviations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
    } catch {
      // fetch itself threw: this is a genuine connectivity failure (no
      // response at all), so the generic network message is accurate here.
      setSubmitError('Network error while uploading. Please try again.');
      setSubmitting(false);
      return;
    }

    // A response came back, so this is a server-side problem, not a
    // network problem. Parse defensively: the server may not always return
    // JSON (e.g. an unhandled exception can produce a plain-text or HTML
    // error page), and that shouldn't be reported to the person as "network
    // error" since the request did reach the server.
    let data: {
      createdCount?: number;
      skipped?: { term: string; reason: 'already_in_database' | 'duplicate_in_file' }[];
      error?: string;
    } = {};
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

    setResult({ createdCount: data.createdCount ?? 0, skipped: data.skipped ?? [] });
    setEntries([]);
    setFileName(null);
    setSubmitting(false);
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
      <h1 className="font-display text-2xl font-semibold text-ink-800">Bulk upload abbreviations &amp; glossary</h1>
      <p className="mt-2 text-ink-500">
        Add many abbreviations or full glossary terms at once from a spreadsheet, instead of one
        at a time.
      </p>

      <Card className="mt-6 space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">How it works</h2>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
          <li>
            Download the template below and open it in Excel, Google Sheets, Numbers, or any
            spreadsheet app. Row 1 (the headers) must stay exactly as it is.
          </li>
          <li>
            Each row is one entry. Fill in <code className="rounded bg-ink-50 px-1">term</code>{' '}
            (a short abbreviation like &ldquo;NPO&rdquo; or a full word/phrase like
            &ldquo;Homeostasis&rdquo;) and <code className="rounded bg-ink-50 px-1">meaning</code>{' '}
            are both required. <code className="rounded bg-ink-50 px-1">category</code> is optional.
          </li>
          <li>
            <code className="rounded bg-ink-50 px-1">type</code> is optional too, so set it to{' '}
            <code className="rounded bg-ink-50 px-1">abbreviation</code> or{' '}
            <code className="rounded bg-ink-50 px-1">glossary</code> per row for a mixed file. If
            you leave the column blank (or your file has no type column at all), the picker below
            decides.
          </li>
          <li>
            Duplicate terms (case-insensitive, within the same type) already in the database, or
            repeated within your file, are skipped automatically and reported after upload.
          </li>
          <li>
            Save the file and upload it below. You&apos;ll get a preview with any problem rows
            called out before anything is published.
          </li>
        </ol>

        <div>
          <label className="text-sm font-medium text-ink-700">Default type for rows without one</label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                checked={!defaultIsGlossary}
                onChange={() => setDefaultIsGlossary(false)}
                className="accent-pulse-500"
              />
              Abbreviation
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                checked={defaultIsGlossary}
                onChange={() => setDefaultIsGlossary(true)}
                className="accent-pulse-500"
              />
              Glossary term
            </label>
          </div>
        </div>

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
          <strong>.csv</strong> spreadsheets, or <strong>.json</strong> (an array of entry objects,
          or <code className="rounded bg-ink-50 px-1">{'{ "entries": [...] }'}</code>).
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
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {entries.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Preview: {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} ready to upload
          </h2>
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {entries.map((e, i) => (
              <div key={i} className="flex items-start gap-4 rounded-md border border-ink-100 p-3">
                <span
                  className={`shrink-0 rounded font-mono text-sm font-semibold ${
                    e.isGlossary ? 'px-2 py-0.5 text-ink-700' : 'w-20 text-pulse-600'
                  }`}
                >
                  {e.abbreviation}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink-700">{e.meaning}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {e.isGlossary && (
                      <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                        Glossary
                      </span>
                    )}
                    {e.category && <p className="text-xs text-ink-400">{e.category}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading…' : `Upload ${entries.length} entries`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEntries([]);
                setFileName(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {submitError && <p className="mt-4 text-sm text-critical-500">{submitError}</p>}

      {result && (
        <Card className="mt-6 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {result.createdCount} entr{result.createdCount === 1 ? 'y' : 'ies'} added successfully.
          </p>
          {result.skipped.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-medium text-ink-600">
                {result.skipped.length} skipped as duplicate{result.skipped.length === 1 ? '' : 's'}:
              </p>
              {(() => {
                const alreadyInDb = result.skipped.filter((s) => s.reason === 'already_in_database');
                const inFile = result.skipped.filter((s) => s.reason === 'duplicate_in_file');
                return (
                  <>
                    {alreadyInDb.length > 0 && (
                      <p className="text-xs text-ink-500">
                        <span className="font-medium text-ink-600">Already in the database</span> (
                        {alreadyInDb.length}): {alreadyInDb.map((s) => s.term).join(', ')}
                      </p>
                    )}
                    {inFile.length > 0 && (
                      <p className="text-xs text-ink-500">
                        <span className="font-medium text-ink-600">Repeated within this file</span> (
                        {inFile.length}): {inFile.map((s) => s.term).join(', ')}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          <Button className="mt-3" size="sm" onClick={() => router.push('/admin/abbreviations')}>
            Back to abbreviations
          </Button>
        </Card>
      )}
    </div>
  );
}
