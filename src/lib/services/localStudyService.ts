// File: src/lib/services/localStudyService.ts
// Browser-only study storage. This service deliberately never calls fetch, APIs, or the database.

export const LOCAL_STUDY_KEY = 'cliniolab_local_study_toolkit_v1';
export const RECENTLY_VIEWED_KEY = 'cliniolab_recently_viewed_v1';
export type LocalRecord = Record<string, unknown>;

export function readLocalStudy<T extends LocalRecord = LocalRecord>(): T {
  if (typeof window === 'undefined') return {} as T;
  try {
    const value = window.localStorage.getItem(LOCAL_STUDY_KEY);
    if (!value) return {} as T;
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : {} as T;
  } catch {
    return {} as T;
  }
}

export function writeLocalStudy<T extends LocalRecord>(patch: Partial<T>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = readLocalStudy<T>();
    window.localStorage.setItem(LOCAL_STUDY_KEY, JSON.stringify({ ...current, ...patch }));
    return true;
  } catch {
    return false;
  }
}

export function readLocalArray<T>(field: string): T[] {
  const value = readLocalStudy()[field];
  return Array.isArray(value) ? value as T[] : [];
}

export function saveLocalArray<T>(field: string, value: T[]): boolean {
  return writeLocalStudy({ [field]: value } as LocalRecord);
}

export function downloadLocalFile(filename: string, content: string, mimeType = 'application/json'): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
