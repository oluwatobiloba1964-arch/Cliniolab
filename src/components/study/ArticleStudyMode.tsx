// File: src/components/study/ArticleStudyMode.tsx
'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'cliniolab_local_study_toolkit_v1';
type SavedTopic = { id: string; title: string; href: string; savedAt: string };
type LocalStudyData = { savedTopics?: SavedTopic[]; articleStudyProgress?: Record<string, { understood: boolean; reviewedAt?: string }>; [key: string]: unknown };
function readData(): LocalStudyData { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LocalStudyData; } catch { return {}; } }
function plainText(content: string): string {
  if (typeof document === 'undefined') return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const node = document.createElement('div'); node.innerHTML = content; return (node.textContent || node.innerText || '').replace(/\s+/g, ' ').trim();
}

/** Optional article study controls; all state and generated prompts stay in the browser. */
export function ArticleStudyMode({ postId, title, content, slug }: { postId: string; title: string; content: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [understood, setUnderstood] = useState(() => {
    try { return readData().articleStudyProgress?.[postId]?.understood ?? false; } catch { return false; }
  });
  const [saved, setSaved] = useState(() => {
    try { return (readData().savedTopics ?? []).some((topic) => topic.id === postId); } catch { return false; }
  });
  const text = useMemo(() => plainText(content), [content]);
  const summary = useMemo(() => {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 4).join(' ').slice(0, 900) || 'Read the article and use the recall prompts below to test your understanding.';
  }, [text]);
  const recallPrompts = useMemo(() => {
    const htmlHeadings = Array.from(content.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)).map((match) => plainText(match[1])).filter(Boolean);
    const markdownHeadings = Array.from(content.matchAll(/^\s{0,3}#{2,3}\s+(.+)$/gm)).map((match) => plainText(match[1])).filter(Boolean);
    const headings = htmlHeadings.length ? htmlHeadings : markdownHeadings;
    const prompts = headings.slice(0, 6).map((heading) => `What are the key points about ${heading}?`);
    if (prompts.length < 3) prompts.push('What is the main concept explained in this article?', 'Which findings, principles, or steps are most important to remember?', 'How does this topic connect to clinical or preclinical practice?');
    return prompts.slice(0, 6);
  }, [content]);

  function updateProgress(value: boolean) {
    setUnderstood(value);
    try {
      const data = readData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, articleStudyProgress: { ...(data.articleStudyProgress ?? {}), [postId]: { understood: value, reviewedAt: new Date().toISOString() } } }));
    } catch {}
  }
  function toggleSaved() {
    try {
      const data = readData();
      const current = data.savedTopics ?? [];
      const next = saved ? current.filter((topic) => topic.id !== postId) : [{ id: postId, title, href: `/blog/${slug}`, savedAt: new Date().toISOString() }, ...current.filter((topic) => topic.id !== postId)].slice(0, 100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedTopics: next }));
      setSaved(!saved);
    } catch {}
  }

  return <section className="mx-auto mt-6 max-w-2xl px-6" aria-label="Article study tools"><Card className="overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-pulse-600">Optional study tools</p><h2 className="mt-1 font-semibold text-ink-800">Study this article</h2><p className="mt-1 text-xs text-ink-500">Quick summary, active recall, and device-local progress.</p></div><button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">{open ? 'Hide study tools' : 'Open Study Mode'}</button></div>
    {open && <div className="border-t border-ink-100 p-4 sm:p-5"><h3 className="text-sm font-semibold text-ink-800">Quick summary</h3><p className="mt-2 text-sm leading-6 text-ink-600">{summary}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setShowRecall((value) => !value)} className="rounded-lg bg-pulse-600 px-3 py-2 text-sm font-semibold text-white">{showRecall ? 'Hide recall prompts' : 'Test my recall'}</button><button type="button" onClick={toggleSaved} className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700">{saved ? 'Remove from revision list' : 'Save topic for revision'}</button><button type="button" onClick={() => updateProgress(!understood)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${understood ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-ink-200 text-ink-700'}`}>{understood ? 'Marked as understood' : 'Mark as understood'}</button></div>
      {showRecall && <div className="mt-5"><h3 className="text-sm font-semibold text-ink-800">Recall prompts</h3><p className="mt-1 text-xs text-ink-500">Answer from memory before reopening the article. Prompts are based on this article's headings and general study questions. They are not AI-generated.</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-700">{recallPrompts.map((prompt, index) => <li key={`${postId}-${index}`}>{prompt}</li>)}</ol></div>}
      <p className="mt-4 text-xs text-ink-400">Progress and saved topics are stored in this device's existing study toolkit record. They do not sync across devices.</p>
    </div>}
  </Card></section>;
}
