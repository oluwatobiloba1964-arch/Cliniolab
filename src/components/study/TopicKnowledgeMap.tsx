'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'cliniolab_local_study_toolkit_v1';
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
  useEffect(() => { setStatuses(readData().topicStatuses ?? {}); setReady(true); }, []);
  const map = MAPS.find((entry) => entry.id === selectedMap) ?? MAPS[0];
  function updateStatus(id: string, status: Status) {
    setStatuses((current) => {
      const next = { ...current, [id]: status };
      try { const data = readData(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, topicStatuses: next })); } catch {}
      return next;
    });
  }
  const completed = map.nodes.filter((node) => statuses[node.id] === 'understood').length;
  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Learn by connection</p>
    <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Topic Knowledge Maps</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Follow the links between foundational knowledge, clinical application, and examination practice. Topic relationships are bundled with the site, and your progress stays in the existing local study record.</p>
    <div className="mt-6 flex flex-wrap gap-2">{MAPS.map((item) => <button key={item.id} type="button" onClick={() => setSelectedMap(item.id)} aria-pressed={selectedMap === item.id} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedMap === item.id ? 'border-pulse-300 bg-pulse-50 text-pulse-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{item.title}</button>)}</div>
    <Card className="mt-5 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink-900">{map.title}</h2><p className="mt-1 text-sm text-ink-500">{map.description}</p></div><span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">{completed}/{map.nodes.length} understood</span></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-pulse-500" style={{ width: `${completed / Math.max(1, map.nodes.length) * 100}%` }} /></div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">{map.nodes.map((node, index) => <article key={node.id} className="relative rounded-xl border border-ink-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-600">Step {index + 1} · {node.group}</p><h3 className="mt-1 font-semibold text-ink-800">{node.title}</h3><p className="mt-1 text-xs text-ink-400">{node.connects.length ? `Connects to: ${node.connects.map((id) => map.nodes.find((item) => item.id === id)?.title ?? id).join(', ')}` : 'End of this learning path'}</p></div><select aria-label={`Progress for ${node.title}`} value={statuses[node.id] ?? 'not-started'} onChange={(event) => updateStatus(node.id, event.target.value as Status)} className="max-w-36 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs"><option value="not-started">Not started</option><option value="studying">Studying</option><option value="revise">Needs revision</option><option value="understood">Understood</option></select></div><div className="mt-3 flex flex-wrap gap-3"><Link href={`/search?q=${encodeURIComponent(node.search)}`} className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Find related content</Link><Link href={`/quizzes`} className="text-xs font-semibold text-pulse-600 hover:text-pulse-700">Browse quizzes</Link></div></article>)}</div>
      {!ready && <p className="mt-4 text-xs text-ink-400">Restoring your local progress…</p>}
    </Card>
    <p className="mt-4 text-xs leading-5 text-ink-400">The map provides a study structure, not a clinical guideline. Topic links use Cliniolab's existing search and quiz pages; availability depends on published content.</p>
  </div>;
}
