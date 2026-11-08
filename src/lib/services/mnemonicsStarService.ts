// File: src/lib/services/mnemonicsStarService.ts
// Browser-only "star" state for mnemonics. Pure client-side: no fetch,
// no API call, no database read. Lets a learner star mnemonics they
// want to revisit, then filter the page by starred-only.

const STAR_KEY = 'cliniolab_mnemonics_starred_v1';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STAR_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STAR_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Best-effort; never let a starred-state failure break the UI.
  }
}

export function isStarred(id: string): boolean {
  return readSet().has(id);
}

export function getStarredIds(): string[] {
  return Array.from(readSet()).sort();
}

export function toggleStar(id: string): boolean {
  const set = readSet();
  let next: boolean;
  if (set.has(id)) {
    set.delete(id);
    next = false;
  } else {
    set.add(id);
    next = true;
  }
  writeSet(set);
  return next;
}
