// File: src/app/api/clinical-practice/bulk/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { clinicalPracticeService } from '@/lib/db';
import type {
  ClinicalPracticeKind,
  NewCaseDraft,
  NewCalculationDraft,
  NewOsceDraft,
  NewItemDraft,
} from '@/lib/db/services/clinicalPracticeService';

const KINDS: ClinicalPracticeKind[] = ['case', 'calculation', 'osce'];

function cleanCaseDraft(raw: Record<string, unknown>): NewCaseDraft | null {
  const title = String(raw.title ?? '').trim();
  const setting = String(raw.setting ?? '').trim();
  const prompt = String(raw.prompt ?? '').trim();
  const keyPoint = String(raw.keyPoint ?? '').trim();
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options = rawOptions
    .map((o) => {
      const opt = o as Record<string, unknown>;
      return {
        label: String(opt.label ?? '').trim(),
        correct: opt.correct === true || opt.correct === 'true',
        feedback: String(opt.feedback ?? '').trim(),
      };
    })
    .filter((o) => o.label && o.feedback);
  if (!title || !prompt || options.length < 2 || !options.some((o) => o.correct)) return null;
  return { title, setting, prompt, options, keyPoint };
}

function cleanCalculationDraft(raw: Record<string, unknown>): NewCalculationDraft | null {
  const prompt = String(raw.prompt ?? '').trim();
  const unit = String(raw.unit ?? '').trim();
  const explanation = String(raw.explanation ?? '').trim();
  const answer = Number(raw.answer);
  const tolerance = raw.tolerance !== undefined && raw.tolerance !== '' ? Number(raw.tolerance) : 0.11;
  if (!prompt || !unit || !explanation || !Number.isFinite(answer) || !Number.isFinite(tolerance)) return null;
  return { prompt, answer, tolerance, unit, explanation };
}

function cleanOsceDraft(raw: Record<string, unknown>): NewOsceDraft | null {
  const title = String(raw.title ?? '').trim();
  const rawSteps = raw.steps;
  const steps = Array.isArray(rawSteps)
    ? rawSteps.map((s) => String(s).trim()).filter(Boolean)
    : typeof rawSteps === 'string'
      ? rawSteps.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean)
      : [];
  if (!title || steps.length < 2) return null;
  return { title, steps };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can add Clinical Practice items' }, { status: 403 });
  }

  let body: { kind?: string; entries?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const kind = body.kind as ClinicalPracticeKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }

  const rawEntries = body.entries ?? [];
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 });
  }

  const cleaner = kind === 'case' ? cleanCaseDraft : kind === 'calculation' ? cleanCalculationDraft : cleanOsceDraft;
  const drafts: NewItemDraft[] = [];
  const skipped: number[] = [];
  rawEntries.forEach((raw, i) => {
    const cleaned = cleaner(raw);
    if (cleaned) drafts.push(cleaned);
    else skipped.push(i + 1);
  });

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No valid rows found for the selected type' }, { status: 400 });
  }

  try {
    const createdIds = await clinicalPracticeService.createItemsBulk(kind, drafts);
    return NextResponse.json({ createdCount: createdIds.length, createdIds, skippedRows: skipped }, { status: 201 });
  } catch (err) {
    console.error('Bulk clinical practice upload failed', err);
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ error: `Upload failed while saving to the database: ${message}` }, { status: 500 });
  }
}
