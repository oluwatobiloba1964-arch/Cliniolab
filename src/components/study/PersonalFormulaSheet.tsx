// src/components/study/PersonalFormulaSheet.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FORMULAS_KEY, makeId, readJson, writeJson } from '@/lib/services/localExtrasService';

interface Formula {
  id: string;
  name: string;
  expression: string;
  unit: string;
  tags: string[];
  notes: string;
  createdAt: string;
}

const SEED_FORMULAS: Formula[] = [
  {
    id: 'seed-dose',
    name: 'Drug dose',
    expression: 'Dose = (Desired dose x Stock volume) / Stock strength',
    unit: 'mL',
    tags: ['pharmacology', 'dose'],
    notes: 'Double check units before calculating.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-drip',
    name: 'IV drip rate',
    expression: 'Drops per minute = (Volume mL x Drop factor) / Time minutes',
    unit: 'gtt/min',
    tags: ['fluids', 'iv'],
    notes: 'Common drop factors: 15, 20, 60.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-bmi',
    name: 'Body mass index',
    expression: 'BMI = Weight kg / (Height m x Height m)',
    unit: 'kg/m2',
    tags: ['assessment'],
    notes: '',
    createdAt: new Date().toISOString(),
  },
];

export function PersonalFormulaSheet() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftExpression, setDraftExpression] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readJson<Formula[]>(FORMULAS_KEY, []);
    if (stored.length === 0) {
      setFormulas(SEED_FORMULAS);
      writeJson(FORMULAS_KEY, SEED_FORMULAS);
    } else {
      setFormulas(stored);
    }
  }, []);

  function persist(next: Formula[]) {
    setFormulas(next);
    writeJson(FORMULAS_KEY, next);
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of formulas) for (const t of f.tags) set.add(t);
    return Array.from(set).sort();
  }, [formulas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return formulas.filter((f) => {
      if (activeTag && !f.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.expression.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [formulas, query, activeTag]);

  function addFormula() {
    setError(null);
    const name = draftName.trim();
    const expression = draftExpression.trim();
    if (!name || !expression) {
      setError('Name and expression are required.');
      return;
    }
    const tags = draftTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const next: Formula = {
      id: makeId(),
      name,
      expression,
      unit: draftUnit.trim(),
      tags,
      notes: draftNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    persist([next, ...formulas]);
    setDraftName('');
    setDraftExpression('');
    setDraftUnit('');
    setDraftTags('');
    setDraftNotes('');
  }

  function remove(id: string) {
    persist(formulas.filter((f) => f.id !== id));
  }

  async function copyFormula(f: Formula) {
    const text = f.unit ? `${f.name}\n${f.expression}\nUnit: ${f.unit}` : `${f.name}\n${f.expression}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(f.id);
    window.setTimeout(() => setCopied((current) => (current === f.id ? null : current)), 1500);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink-800">My formula sheet</h3>
          <p className="mt-1 text-sm text-ink-500">
            Save the formulas you use most. Stored on this device only.
          </p>
        </div>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-500">
          {formulas.length} saved
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search formulas"
          className="min-h-11 rounded-lg border border-ink-200 bg-white px-3 text-sm"
        />
        <span className="text-xs text-ink-400 sm:self-center">
          {filtered.length} of {formulas.length}
        </span>
      </div>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              activeTag === null
                ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                : 'border-ink-200 text-ink-500'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activeTag === tag
                  ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                  : 'border-ink-200 text-ink-500'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {filtered.map((f) => (
          <li key={f.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-800">{f.name}</p>
                  <p className="mt-1 break-words font-mono text-sm text-ink-600">{f.expression}</p>
                  {f.unit && <p className="mt-1 text-xs text-ink-500">Unit: {f.unit}</p>}
                  {f.notes && <p className="mt-2 text-xs text-ink-500">{f.notes}</p>}
                  {f.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.tags.map((tag) => (
                        <span key={tag} className="rounded bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => copyFormula(f)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:border-pulse-300 hover:text-pulse-700"
                  >
                    {copied === f.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-500 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </Card>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed border-ink-200 p-5 text-sm text-ink-500">
            No formulas match this view.
          </li>
        )}
      </ul>

      <Card className="mt-5 p-4">
        <p className="font-semibold text-ink-800">Add a formula</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Name, e.g. Creatinine clearance"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
          <input
            value={draftUnit}
            onChange={(e) => setDraftUnit(e.target.value)}
            placeholder="Unit, e.g. mL/min"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
          <textarea
            value={draftExpression}
            onChange={(e) => setDraftExpression(e.target.value)}
            rows={2}
            placeholder="Expression"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder="Tags, comma separated"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
          <input
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Short note (optional)"
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={addFormula}
          className="mt-3 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-700"
        >
          Save formula
        </button>
      </Card>
    </div>
  );
}
