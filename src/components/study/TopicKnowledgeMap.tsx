'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, BookOpen, Layers3, LibraryBig, RotateCcw, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'cliniolab_local_study_toolkit_v1';
const RECENTLY_VIEWED_KEY = 'cliniolab_recently_viewed_v1';
type RecentItem = { href: string; title: string; viewedAt?: string };
type Status = 'not-started' | 'studying' | 'understood' | 'revise';
type Node = { id: string; title: string; group: string; connects: string[]; search: string };
const MAPS: Array<{ id: string; title: string; description: string; nodes: Node[] }> = [
  { id: 'core-sciences', title: 'Core Sciences to Clinical Practice', description: 'Connect foundational concepts to the clinical topics they support.', nodes: [
    { id: 'anatomy', title: 'Anatomy', group: 'Foundation', connects: ['physiology'], search: 'anatomy' },
    { id: 'physiology', title: 'Physiology', group: 'Foundation', connects: ['assessment', 'pathophysiology'], search: 'physiology' },
    { id: 'pathophysiology', title: 'Pathophysiology', group: 'Bridge', connects: ['clinical-conditions'], search: 'pathophysiology' },
    { id: 'assessment', title: 'Clinical Assessment', group: 'Clinical', connects: ['investigations'], search: 'clinical assessment' },
    { id: 'investigations', title: 'Investigations', group: 'Clinical', connects: ['clinical-conditions'], search: 'clinical investigations' },
    { id: 'clinical-conditions', title: 'Clinical Conditions', group: 'Clinical', connects: ['management'], search: 'clinical conditions' },
    { id: 'management', title: 'Management Principles', group: 'Application', connects: [], search: 'clinical management' },
  ] },
  { id: 'pharmacology', title: 'Pharmacology Learning Map', description: 'Move from drug fundamentals to safe application.', nodes: [
    { id: 'drug-classes', title: 'Drug Classes', group: 'Foundation', connects: ['mechanisms'], search: 'drug classification' },
    { id: 'mechanisms', title: 'Mechanisms of Action', group: 'Foundation', connects: ['pharmacokinetics'], search: 'mechanism of action' },
    { id: 'pharmacokinetics', title: 'Pharmacokinetics', group: 'Principles', connects: ['adverse-effects'], search: 'pharmacokinetics' },
    { id: 'adverse-effects', title: 'Adverse Effects', group: 'Safety', connects: ['safe-administration'], search: 'adverse drug effects' },
    { id: 'safe-administration', title: 'Safe Administration', group: 'Application', connects: [], search: 'safe medication administration' },
  ] },
  { id: 'exam-practice', title: 'Exam and Clinical Skills Map', description: 'Link knowledge, question practice, and practical assessment.', nodes: [
    { id: 'knowledge-review', title: 'Knowledge Review', group: 'Prepare', connects: ['question-practice'], search: 'exam revision' },
    { id: 'question-practice', title: 'Question Practice', group: 'Practise', connects: ['case-reasoning'], search: 'clinical practice quiz' },
    { id: 'case-reasoning', title: 'Case Reasoning', group: 'Apply', connects: ['skills-checklist'], search: 'clinical case' },
    { id: 'skills-checklist', title: 'Skills Checklist', group: 'Demonstrate', connects: [], search: 'OSCE checklist' },
  ] },
];

type LocalData = { topicStatuses?: Record<string, Status>; [key: string]: unknown };
function readData(): LocalData { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LocalData; } catch { return {}; } }

/** Static topic relationships, with progress stored in the existing study toolkit record. */
export function TopicKnowledgeMap() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [selectedMap, setSelectedMap] = useState(MAPS[0].id);
  const [ready, setReady] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    setStatuses(readData().topicStatuses ?? {});
    try {
      const raw = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
      setRecentItems(Array.isArray(raw) ? raw.filter((item) => item && typeof item.href === 'string' && item.href.startsWith('/') && !item.href.startsWith('//') && typeof item.title === 'string').slice(0, 4) : []);
    } catch { setRecentItems([]); }
    setReady(true);
  }, []);
  const map = MAPS.find((entry) => entry.id === selectedMap) ?? MAPS[0];
  const visibleNodes = useMemo(() => {
    const term = topicSearch.trim().toLowerCase();
    return map.nodes.filter((node) => {
      const matchesTerm = !term || `${node.title} ${node.group} ${node.search}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || (statuses[node.id] ?? 'not-started') === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [map, topicSearch, statusFilter, statuses]);
  function updateStatus(id: string, status: Status) {
    setStatuses((current) => {
      const next = { ...current, [id]: status };
      try { const data = readData(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, topicStatuses: next })); } catch {}
      return next;
    });
  }
  const completed = map.nodes.filter((node) => statuses[node.id] === 'understood').length;
  const needsRevision = map.nodes.filter((node) => statuses[node.id] === 'revise').length;
  const inProgress = map.nodes.filter((node) => statuses[node.id] === 'studying').length;
  const nextSuggestedNode = map.nodes.find((node) => statuses[node.id] === 'revise') ?? map.nodes.find((node) => (statuses[node.id] ?? 'not-started') === 'not-started');
  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Learn by connection</p>
    <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Topic Knowledge Maps</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">A connected starting point for your medical study: follow a learning path, find matching content, practise questions, open flashcards, and return to revision. Your topic progress stays in the existing local study record.</p>
    <section className="mt-5 rounded-xl border border-pulse-100 bg-pulse-50/50 p-4 sm:p-5" aria-labelledby="cliniolab-whats-new-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-pulse-700">Product tips</p><h2 id="cliniolab-whats-new-title" className="mt-1 font-semibold text-ink-900">Make each study session count</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">Use the existing quiz review, local revision tools, and flashcard scheduling together. No new account data or external service is needed.</p></div><Link href="/dashboard" className="rounded-lg border border-pulse-200 bg-white px-3 py-2 text-xs font-semibold text-pulse-700 hover:bg-pulse-50">Open study toolkit</Link></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-white bg-white p-3"><p className="text-sm font-semibold text-ink-800">Review weak areas</p><p className="mt-1 text-xs leading-5 text-ink-500">Use mistakes and marked questions to choose what to revisit.</p></div><div className="rounded-lg border border-white bg-white p-3"><p className="text-sm font-semibold text-ink-800">Protect local data</p><p className="mt-1 text-xs leading-5 text-ink-500">Export a local backup before clearing browser data or changing devices.</p></div><div className="rounded-lg border border-white bg-white p-3"><p className="text-sm font-semibold text-ink-800">Make reading easier</p><p className="mt-1 text-xs leading-5 text-ink-500">Set text size and spacing in your study toolkit preferences.</p></div></div>
    </section>
    {recentItems.length > 0 && <section className="mt-5" aria-labelledby="continue-studying-title"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="continue-studying-title" className="font-semibold text-ink-900">Continue studying</h2><Link href="/dashboard" className="text-xs font-semibold text-pulse-700 hover:underline">View all recent items</Link></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{recentItems.map((item) => <Link key={`${item.href}-${item.title}`} href={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3 transition hover:border-pulse-200 hover:shadow-sm"><span className="min-w-0 truncate text-sm font-semibold text-ink-800">{item.title}</span><span className="shrink-0 text-xs font-semibold text-pulse-700">Resume</span></Link>)}</div></section>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/quizzes" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:border-pulse-200 hover:shadow-sm"><BookOpen className="h-5 w-5 text-pulse-600"/><p className="mt-3 text-sm font-semibold text-ink-800">Practise quizzes</p><p className="mt-1 text-xs leading-5 text-ink-500">Test knowledge with existing question sets.</p></Link>
      <Link href="/flashcards" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:border-pulse-200 hover:shadow-sm"><Layers3 className="h-5 w-5 text-pulse-600"/><p className="mt-3 text-sm font-semibold text-ink-800">Study flashcards</p><p className="mt-1 text-xs leading-5 text-ink-500">Review concepts with existing decks.</p></Link>
      <Link href="/resources" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:border-pulse-200 hover:shadow-sm"><LibraryBig className="h-5 w-5 text-pulse-600"/><p className="mt-3 text-sm font-semibold text-ink-800">Browse resources</p><p className="mt-1 text-xs leading-5 text-ink-500">Find books and past question packs.</p></Link>
      <Link href="/study/revision" className="group rounded-xl border border-ink-100 bg-white p-4 transition hover:border-pulse-200 hover:shadow-sm"><RotateCcw className="h-5 w-5 text-pulse-600"/><p className="mt-3 text-sm font-semibold text-ink-800">Revision queue</p><p className="mt-1 text-xs leading-5 text-ink-500">Return to saved items and missed questions.</p></Link>
    </div>
    <div className="mt-6 flex flex-wrap gap-2">{MAPS.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedMap(item.id); setTopicSearch(''); setStatusFilter('all'); }} aria-pressed={selectedMap === item.id} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedMap === item.id ? 'border-pulse-300 bg-pulse-50 text-pulse-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{item.title}</button>)}</div>
    <Card className="mt-5 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink-900">{map.title}</h2><p className="mt-1 text-sm text-ink-500">{map.description}</p></div><span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">{completed}/{map.nodes.length} understood</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg border border-ink-100 p-3"><p className="text-xs text-ink-500">Understood</p><p className="mt-1 text-xl font-semibold text-pulse-700">{completed}</p></div><div className="rounded-lg border border-ink-100 p-3"><p className="text-xs text-ink-500">In progress</p><p className="mt-1 text-xl font-semibold text-ink-800">{inProgress}</p></div><div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3"><p className="text-xs text-amber-800">Needs revision</p><p className="mt-1 text-xl font-semibold text-amber-900">{needsRevision}</p></div><div className="rounded-lg border border-ink-100 p-3"><p className="text-xs text-ink-500">Not started</p><p className="mt-1 text-xl font-semibold text-ink-800">{map.nodes.length - completed - inProgress - needsRevision}</p></div></div>
      {nextSuggestedNode && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pulse-100 bg-pulse-50/60 p-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-pulse-700">Suggested next step</p><p className="mt-1 text-sm font-semibold text-ink-800">{nextSuggestedNode.title}</p><p className="mt-1 text-xs text-ink-500">{statuses[nextSuggestedNode.id] === 'revise' ? 'This topic is marked for revision. Revisit the material before retesting.' : 'Continue through the learning path, then test your recall.'}</p></div><div className="flex flex-wrap gap-2"><Link href={`/search?q=${encodeURIComponent(nextSuggestedNode.search)}`} className="rounded-lg bg-pulse-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pulse-700">Find material</Link><Link href="/quizzes" className="rounded-lg border border-pulse-200 bg-white px-3 py-2 text-xs font-semibold text-pulse-700">Test knowledge</Link></div></div>}
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-pulse-500" style={{ width: `${completed / Math.max(1, map.nodes.length) * 100}%` }} /></div>
      <div className="mt-5 relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"/><input value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} aria-label="Filter topics in this learning map" placeholder="Filter topics in this learning path…" className="min-h-11 w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100"/></div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter topics by progress">{([{ value: 'all', label: 'All topics' }, { value: 'not-started', label: 'Not started' }, { value: 'studying', label: 'In progress' }, { value: 'revise', label: 'Needs revision' }, { value: 'understood', label: 'Understood' }] as const).map((item) => <button key={item.value} type="button" aria-pressed={statusFilter === item.value} onClick={() => setStatusFilter(item.value)} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === item.value ? 'border-pulse-300 bg-pulse-50 text-pulse-700' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'}`}>{item.label}</button>)}</div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{visibleNodes.map((node) => { const index = map.nodes.findIndex((item) => item.id === node.id); return <article key={node.id} className="relative rounded-xl border border-ink-100 p-4 transition hover:border-ink-200"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-600">Step {index + 1} · {node.group}</p><h3 className="mt-1 font-semibold text-ink-800">{node.title}</h3><p className="mt-1 text-xs text-ink-400">{node.connects.length ? `Connects to: ${node.connects.map((id) => map.nodes.find((item) => item.id === id)?.title ?? id).join(', ')}` : 'End of this learning path'}</p></div><select aria-label={`Progress for ${node.title}`} value={statuses[node.id] ?? 'not-started'} onChange={(event) => updateStatus(node.id, event.target.value as Status)} className="max-w-36 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs"><option value="not-started">Not started</option><option value="studying">Studying</option><option value="revise">Needs revision</option><option value="understood">Understood</option></select></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-100 pt-3"><Link href={`/search?q=${encodeURIComponent(node.search)}`} className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Find related content</Link><Link href={`/resources?q=${encodeURIComponent(node.search)}`} className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Find resources</Link><Link href="/quizzes" className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Browse quizzes</Link><Link href="/flashcards" className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Flashcards</Link></div></article>; })}</div>
      {visibleNodes.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-ink-200 p-6 text-center"><p className="text-sm font-semibold text-ink-700">No topics match “{topicSearch}”</p><button type="button" onClick={() => setTopicSearch('')} className="mt-2 text-sm font-semibold text-pulse-600">Clear topic search</button></div>}
      {!ready && <p className="mt-4 text-xs text-ink-400">Restoring your local progress…</p>}
    </Card>
    <div className="mt-4 flex flex-wrap items-start gap-2 rounded-xl border border-pulse-100 bg-pulse-50/60 p-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-pulse-700"/><p className="text-xs leading-5 text-ink-600"><span className="font-semibold text-ink-800">Your data stays local.</span> Topic status is saved in your existing browser study record. Cliniolab already provides Backup &amp; Restore in the dashboard’s personal learning toolkit if you want to export supported local study data.</p><Link href="/dashboard" className="shrink-0 text-xs font-semibold text-pulse-700 hover:underline">Open dashboard</Link></div>
    <p className="mt-4 text-xs leading-5 text-ink-400">These maps provide a study structure, not clinical guidance. Links use Cliniolab’s existing search, quiz, flashcard, and resource pages; available material depends on published content.</p>
  </div>;
}
