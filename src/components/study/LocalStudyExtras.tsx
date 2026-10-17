// File: src/components/study/LocalStudyExtras.tsx
'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { downloadLocalFile, LOCAL_STUDY_KEY, RECENTLY_VIEWED_KEY, readLocalStudy, writeLocalStudy } from '@/lib/services/localStudyService';
import { PersonalFormulaSheet } from './PersonalFormulaSheet';
import { ReflectionJournal } from './ReflectionJournal';
import { PersonalGoalsCard } from './PersonalGoalsCard';
import { StudySessionPresets } from './StudySessionPresets';
import { UpcomingExamsCard } from './UpcomingExamsCard';
import { CopiedExplanationsLog } from './CopiedExplanationsLog';

type Tab = 'overview' | 'search' | 'mistakes' | 'recent' | 'glossary' | 'decks' | 'planner' | 'history' | 'notes' | 'formulas' | 'journal' | 'preferences' | 'backup';
type Viewed = { href: string; title: string; viewedAt: string };
type GlossaryItem = { id: string; term: string; definition: string; subject: string; createdAt: string };
type LocalCard = { id: string; front: string; back: string; difficulty: 'easy' | 'medium' | 'hard'; subject: string };
type Deck = { id: string; title: string; cards: LocalCard[]; createdAt: string };
type Session = { id: string; title: string; minutes: number; date: string; kind: string };
type Annotation = { id: string; title: string; href: string; body: string; updatedAt: string };
type Preference = { defaultSessionMinutes?: number; dailyTargetMinutes?: number; compactCards?: boolean; showLocalReminders?: boolean };
type Toolkit = {
  tasks?: Array<{ id: string; text: string; done: boolean; date: string }>;
  notes?: Array<{ id: string; title: string; body: string; updatedAt: string }>;
  minutesByDay?: Record<string, number>;
  studyDays?: string[];
  dailyGoalMinutes?: number;
  glossary?: GlossaryItem[];
  customDecks?: Deck[];
  localSessions?: Session[];
  articleAnnotations?: Annotation[];
  studyPreferences?: Preference;
  [key: string]: unknown;
};
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);
const safeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const btn = 'rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:border-pulse-300 hover:bg-pulse-50';
const primary = 'rounded-lg bg-pulse-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-pulse-700';

/** Extra learning tools built entirely on browser storage and already-loaded content. */
export function LocalStudyExtras() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<Toolkit>({});
  const [recent, setRecent] = useState<Viewed[]>([]);
  const [missed, setMissed] = useState<Array<{ id: string; count: number }>>([]);
  const [ready, setReady] = useState(false);
  const [term, setTerm] = useState(''); const [definition, setDefinition] = useState(''); const [subject, setSubject] = useState('General'); const [glossarySearch, setGlossarySearch] = useState('');
  const [deckTitle, setDeckTitle] = useState(''); const [front, setFront] = useState(''); const [back, setBack] = useState(''); const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium'); const [deckId, setDeckId] = useState(''); const [cardFilter, setCardFilter] = useState<'all'|'easy'|'medium'|'hard'>('all'); const [shuffled, setShuffled] = useState<LocalCard[]>([]); const [cardIndex, setCardIndex] = useState(0);
  const [plannerGoal, setPlannerGoal] = useState(''); const [sessionTitle, setSessionTitle] = useState('Study session'); const [sessionMinutes, setSessionMinutes] = useState(25);
  const [annotationTitle, setAnnotationTitle] = useState(''); const [annotationHref, setAnnotationHref] = useState('/blog'); const [annotationBody, setAnnotationBody] = useState('');
  const [preferences, setPreferences] = useState<Preference>({ defaultSessionMinutes: 25, dailyTargetMinutes: 30, compactCards: false, showLocalReminders: true });
  const [message, setMessage] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    const stored = readLocalStudy<Toolkit>();
    setData(stored);
    setPreferences({ defaultSessionMinutes: 25, dailyTargetMinutes: Number(stored.dailyGoalMinutes) || 30, compactCards: false, showLocalReminders: true, ...(stored.studyPreferences ?? {}) });
    try {
      const recentItems = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
      setRecent(safeArray<Viewed>(recentItems).filter((item) => item && typeof item.href === 'string').slice(0, 12));
      const errors: Array<{ id: string; count: number }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('cl-guest-missed:')) continue;
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(parsed) && parsed.length) errors.push({ id: key.slice('cl-guest-missed:'.length), count: parsed.length });
      }
      setMissed(errors);
    } catch { /* Keep local tools available when browser storage is restricted. */ }
    setReady(true);
  }, []);

  const persist = (patch: Partial<Toolkit>, notice = 'Saved on this device.') => {
    const next = { ...readLocalStudy<Toolkit>(), ...patch };
    setData(next);
    const ok = writeLocalStudy<Toolkit>(patch);
    setMessage(ok ? notice : "Couldn't save — your browser storage may be full. Try exporting your data or freeing up space.");
  };
  const glossary = safeArray<GlossaryItem>(data.glossary);
  const decks = safeArray<Deck>(data.customDecks);
  const sessions = safeArray<Session>(data.localSessions);
  const annotations = safeArray<Annotation>(data.articleAnnotations);
  const notes = safeArray<{ id: string; title: string; body: string; updatedAt: string }>(data.notes);
  const tasks = safeArray<{ id: string; text: string; done: boolean; date: string }>(data.tasks);
  const minutesByDay = (data.minutesByDay && typeof data.minutesByDay === 'object' ? data.minutesByDay : {}) as Record<string, number>;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10); }), []);
  const weekMinutes = weekDays.reduce((sum, day) => sum + (Number(minutesByDay[day]) || 0), 0);
  const dueTasks = tasks.filter((task) => !task.done && task.date <= today());
  const readinessSignals = Math.min(100, (Math.min(40, sessions.length * 4) + Math.min(25, notes.length * 3) + Math.min(20, glossary.length * 2) + Math.min(15, Math.max(0, 15 - missed.reduce((sum, item) => sum + item.count, 0)))));
  const filteredGlossary = glossary.filter((item) => `${item.term} ${item.definition} ${item.subject}`.toLowerCase().includes(glossarySearch.toLowerCase()));
  const selectedDeck = decks.find((deck) => deck.id === deckId) ?? decks[0];
  const currentCards = shuffled.length ? shuffled : selectedDeck?.cards ?? [];
  const filteredCards = currentCards.filter((card) => cardFilter === 'all' || card.difficulty === cardFilter);
  const overdueCount = dueTasks.length + missed.reduce((sum, item) => sum + item.count, 0);
  const searchTerm = globalSearch.trim().toLowerCase();
  const localSearchResults = useMemo(() => {
    if (!searchTerm) return [];
    const results: Array<{ id: string; type: string; title: string; detail: string; href?: string }> = [];
    for (const item of glossary) if (`${item.term} ${item.definition} ${item.subject}`.toLowerCase().includes(searchTerm)) results.push({ id: `glossary-${item.id}`, type: 'Glossary', title: item.term, detail: item.definition, href: undefined });
    for (const item of notes) if (`${item.title} ${item.body}`.toLowerCase().includes(searchTerm)) results.push({ id: `note-${item.id}`, type: 'Study note', title: item.title || 'Untitled note', detail: item.body });
    for (const item of annotations) if (`${item.title} ${item.body} ${item.href}`.toLowerCase().includes(searchTerm)) results.push({ id: `annotation-${item.id}`, type: 'Article annotation', title: item.title, detail: item.body, href: item.href });
    for (const deck of decks) { if (deck.title.toLowerCase().includes(searchTerm)) results.push({ id: `deck-${deck.id}`, type: 'Personal deck', title: deck.title, detail: `${deck.cards.length} cards` }); for (const card of deck.cards) if (`${card.front} ${card.back} ${card.subject}`.toLowerCase().includes(searchTerm)) results.push({ id: `card-${deck.id}-${card.id}`, type: 'Personal flashcard', title: card.front, detail: card.back }); }
    for (const item of recent) if (`${item.title} ${item.href}`.toLowerCase().includes(searchTerm)) results.push({ id: `recent-${item.href}`, type: 'Recently viewed', title: item.title, detail: item.href, href: item.href });
    return results.slice(0, 100);
  }, [searchTerm, glossary, notes, annotations, decks, recent]);

  function addGlossary(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!term.trim() || !definition.trim()) return;
    persist({ glossary: [{ id: uid(), term: term.trim(), definition: definition.trim(), subject: subject.trim() || 'General', createdAt: new Date().toISOString() }, ...glossary].slice(0, 500) });
    setTerm(''); setDefinition('');
  }
  function createDeck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!deckTitle.trim()) return;
    const deck: Deck = { id: uid(), title: deckTitle.trim(), cards: [], createdAt: new Date().toISOString() };
    persist({ customDecks: [deck, ...decks].slice(0, 100) }, 'Deck created.'); setDeckId(deck.id); setDeckTitle(''); setShuffled([]);
  }
  function addCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedDeck || !front.trim() || !back.trim()) return;
    const card: LocalCard = { id: uid(), front: front.trim(), back: back.trim(), difficulty, subject: subject.trim() || 'General' };
    persist({ customDecks: decks.map((deck) => deck.id === selectedDeck.id ? { ...deck, cards: [...deck.cards, card].slice(0, 500) } : deck) }, 'Card added.'); setFront(''); setBack(''); setShuffled([]);
  }
  function addPlannerTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!plannerGoal.trim()) return;
    persist({ tasks: [{ id: uid(), text: plannerGoal.trim(), done: false, date: today() }, ...tasks].slice(0, 200) }, 'Added to your study plan.'); setPlannerGoal('');
  }
  function logSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const mins = Math.max(1, Math.min(600, Number(sessionMinutes) || 25)); const day = today();
    const nextSessions = [{ id: uid(), title: sessionTitle.trim() || 'Study session', minutes: mins, date: new Date().toISOString(), kind: 'Manual log' }, ...sessions].slice(0, 500);
    const nextMinutes = { ...minutesByDay, [day]: (Number(minutesByDay[day]) || 0) + mins };
    const studyDays = Array.from(new Set([...safeArray<string>(data.studyDays), day]));
    persist({ localSessions: nextSessions, minutesByDay: nextMinutes, studyDays }, 'Session logged.');
  }
  function addAnnotation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!annotationBody.trim()) return;
    persist({ articleAnnotations: [{ id: uid(), title: annotationTitle.trim() || 'Article note', href: annotationHref.trim() || '/blog', body: annotationBody.trim(), updatedAt: new Date().toISOString() }, ...annotations].slice(0, 300) }, 'Annotation saved.'); setAnnotationBody(''); setAnnotationTitle('');
  }
  function savePreferences(next: Preference) {
    setPreferences(next); persist({ studyPreferences: next, dailyGoalMinutes: next.dailyTargetMinutes ?? data.dailyGoalMinutes ?? 30 }, 'Preferences saved.');
  }
  function exportNotes() {
    const text = notes.map((note) => `# ${note.title}\nUpdated: ${note.updatedAt}\n\n${note.body}`).join('\n\n---\n\n');
    setMessage(downloadLocalFile(`cliniolab-study-notes-${today()}.md`, text, 'text/markdown;charset=utf-8') ? 'Study notes exported.' : "Couldn't export notes in this browser.");
  }
  function exportBackup() {
    const localRecords: Record<string, string> = {};
    const allowedLocalKey = (key: string) => key.startsWith('cl-guest-missed:') || key.startsWith('cl-missed:') || key.startsWith('cliniolab:spaced-repetition:') || key.startsWith('cliniolab:draft:flashcards:') || key.startsWith('cliniolab:draft:study:');
    try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && allowedLocalKey(key)) { const value = localStorage.getItem(key); if (value !== null) localRecords[key] = value; } } } catch {}
    const payload = { format: 'cliniolab-local-study-backup', version: 1, exportedAt: new Date().toISOString(), toolkit: readLocalStudy(), recentlyViewed: recent, localRecords };
    setMessage(downloadLocalFile(`cliniolab-study-backup-${today()}.json`, JSON.stringify(payload, null, 2)) ? 'Backup downloaded.' : "Couldn't create a backup in this browser.");
  }
  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup file is larger than 10 MB. Choose a smaller Cliniolab backup.');
      if (!window.confirm('Restore this backup? It will replace your current local study toolkit and may overwrite matching saved revision records. Export a backup of your current data first if you need it.')) return;
      const parsed = JSON.parse(await file.text()) as { format?: string; version?: number; toolkit?: Toolkit; recentlyViewed?: Viewed[]; localRecords?: Record<string, string> };
      if (parsed.format !== 'cliniolab-local-study-backup' || !parsed.toolkit || typeof parsed.toolkit !== 'object' || Array.isArray(parsed.toolkit)) throw new Error("That doesn't look like a Cliniolab backup file.");
      const allowedLocalKey = (key: string) => key.startsWith('cl-guest-missed:') || key.startsWith('cl-missed:') || key.startsWith('cliniolab:spaced-repetition:') || key.startsWith('cliniolab:draft:flashcards:') || key.startsWith('cliniolab:draft:study:');
      const cleanRecent = safeArray<Viewed>(parsed.recentlyViewed).filter((item) => item && typeof item.href === 'string' && typeof item.title === 'string').slice(0, 100);
      const localRecords = parsed.localRecords && typeof parsed.localRecords === 'object' ? Object.entries(parsed.localRecords).filter(([key, value]) => allowedLocalKey(key) && typeof value === 'string' && value.length <= 500000).slice(0, 500) : [];
      localStorage.setItem(LOCAL_STUDY_KEY, JSON.stringify(parsed.toolkit));
      if (Array.isArray(parsed.recentlyViewed)) localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(cleanRecent));
      for (const [key, value] of localRecords) localStorage.setItem(key, value as string);
      setData(parsed.toolkit); setRecent(cleanRecent); setMessage('Backup restored on this device. Reload pages with open study sessions to refresh their local state.');
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't restore that backup."); }
    finally { e.target.value = ''; }
  }
  function shuffleDeck() {
    const source = selectedDeck?.cards ?? [];
    const next = [...source];
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    setShuffled(next); setCardIndex(0);
  }
  function markMistakeReviewed(quizId: string) {
    try { localStorage.removeItem(`cl-guest-missed:${quizId}`); setMissed((old) => old.filter((item) => item.id !== quizId)); setMessage('Cleared from this device.'); } catch {}
  }

  const tabs: Array<[Tab, string]> = [['overview','Overview'],['search','Search my study data'],['mistakes','Mistakes'],['recent','Recent & resume'],['glossary','Glossary'],['formulas','Formulas'],['decks','My flashcards'],['planner','Revision planner'],['journal','Journal'],['history','Reports'],['notes','Notes & annotations'],['preferences','Preferences'],['backup','Backup']];
  return <section className="mt-8" aria-labelledby="local-study-extras-title">
    <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Browser-only tools</p><h2 id="local-study-extras-title" className="mt-1 font-display text-2xl font-semibold text-ink-900">Your personal learning toolkit</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">Everything on this page lives only in your browser — nothing is sent to our servers, and it won't follow you to another device.</p></div>
    <Card className="overflow-hidden p-0">
      <div className="flex gap-1 overflow-x-auto border-b border-ink-100 bg-ink-50/70 p-2" role="tablist" aria-label="Personal learning tools">{tabs.map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={tab===key} onClick={() => { setTab(key); setMessage(''); }} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab===key?'bg-white text-pulse-700 shadow-sm':'text-ink-500 hover:bg-white hover:text-ink-800'}`}>{label}</button>)}</div>
      <div className="p-4 sm:p-6">
        {message && <p className="mb-4 rounded-lg border border-pulse-100 bg-pulse-50 px-3 py-2 text-sm text-pulse-800" role="status">{message}</p>}
        {!ready ? <p className="text-sm text-ink-500">Loading this device's study records…</p> : <>
          {tab==='search' && <div><h3 className="font-semibold text-ink-800">Search your saved study data</h3><p className="mt-1 text-sm text-ink-500">Search personal notes, glossary terms, annotations, custom flashcards and recently viewed pages saved in this browser. This search stays on your device.</p><label className="mt-4 block"><span className="sr-only">Search personal study data</span><input autoFocus value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="Search notes, terms, cards or recent pages..." className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-pulse-400 focus:ring-2 focus:ring-pulse-100" /></label>{searchTerm && <p className="mt-3 text-xs text-ink-400">{localSearchResults.length} result{localSearchResults.length===1?'':'s'} found{localSearchResults.length===100?' (showing first 100)':''}.</p>}<div className="mt-4 space-y-2">{localSearchResults.map(result=><article key={result.id} className="rounded-xl border border-ink-100 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className="text-[10px] font-semibold uppercase tracking-wide text-pulse-600">{result.type}</span><h4 className="mt-1 font-semibold text-ink-800">{result.title}</h4></div>{result.href && <Link href={result.href.startsWith('/') && !result.href.startsWith('//')?result.href:'/blog'} className="text-xs font-semibold text-pulse-600">Open</Link>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">{result.detail}</p></article>)}</div>{searchTerm && localSearchResults.length===0 && <Empty text="No local study items match that search. Try another term or check the individual tool."/>}{!searchTerm && <Empty text="Type a word or phrase to search your locally saved study materials."/>}</div>}
          {tab==='overview' && <div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Study minutes this week" value={weekMinutes} helper="From sessions you've logged"/><Metric label="Missed questions" value={missed.reduce((sum,item)=>sum+item.count,0)} helper="Saved from your quiz attempts"/><Metric label="Revision tasks due" value={dueTasks.length} helper="From your existing study plan"/><Metric label="Local readiness signals" value={`${readinessSignals}%`} helper="A rough gauge of your activity, not an exam prediction"/></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-ink-100 p-4"><h3 className="font-semibold text-ink-800">Your next steps</h3><ul className="mt-3 space-y-2 text-sm text-ink-600"><li>• Review {missed.reduce((sum,item)=>sum+item.count,0)} locally recorded missed questions.</li><li>• Complete {dueTasks.length} overdue or due revision tasks.</li><li>• Add key terms to your personal glossary.</li><li>• Record a study session to build a weekly report.</li></ul><div className="mt-4 flex flex-wrap gap-2"><button className={btn} onClick={()=>setTab('mistakes')}>Review mistakes</button><button className={btn} onClick={()=>setTab('planner')}>Plan revision</button></div></div><div className="rounded-xl border border-ink-100 p-4"><h3 className="font-semibold text-ink-800">Weekly study activity</h3><div className="mt-4 grid grid-cols-7 gap-2">{weekDays.map((day)=>{const mins=Number(minutesByDay[day])||0;return <div key={day} className="text-center"><div className="flex h-20 items-end overflow-hidden rounded-md bg-ink-50"><div className="w-full rounded-t bg-pulse-500" style={{height:`${Math.max(mins?8:0,Math.min(100,mins/Math.max(30,preferences.dailyTargetMinutes||30)*100))}%`}}/></div><p className="mt-1 text-[10px] text-ink-400">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{weekday:'short'})}</p><p className="text-[10px] font-semibold text-ink-600">{mins}m</p></div>})}</div><p className="mt-3 text-xs text-ink-400">Shows minutes you've logged on this device.</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><UpcomingExamsCard /><PersonalGoalsCard /></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><StudySessionPresets /><CopiedExplanationsLog /></div></div>}
          {tab==='mistakes' && <div><h3 className="font-semibold text-ink-800">Mistake Notebook</h3><p className="mt-1 text-sm text-ink-500">Pulls together the questions you've missed in guest quizzes. We only keep the question IDs here, so tap Review to see the full question again.</p>{missed.length===0?<Empty text="Nothing here yet — missed questions from a guest quiz will show up once you've taken one."/>:<div className="mt-4 space-y-2">{missed.map((item)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-4"><div><p className="font-semibold text-ink-800">Quiz {item.id}</p><p className="mt-1 text-xs text-ink-500">{item.count} missed question IDs saved on this device</p></div><div className="flex gap-2"><Link className={primary} href={`/quizzes/${encodeURIComponent(item.id)}?retakeMissed=1`}>Review</Link><button className={btn} onClick={()=>markMistakeReviewed(item.id)}>Clear record</button></div></div>)}</div>}</div>}
          {tab==='recent' && <div><h3 className="font-semibold text-ink-800">Recently viewed</h3><p className="mt-1 text-sm text-ink-500">Pages you've visited recently on this device. Looking for an unfinished quiz? Check the resume section on the homepage.</p>{recent.length===0?<Empty text="Pages you visit will appear here."/>:<div className="mt-4 grid gap-3 sm:grid-cols-2">{recent.map((item)=><Link key={item.href} href={item.href} className="rounded-xl border border-ink-100 p-4 transition hover:border-pulse-200 hover:bg-pulse-50/30"><p className="font-semibold text-ink-800">{item.title}</p><p className="mt-1 truncate text-xs text-ink-400">{item.href}</p><p className="mt-2 text-xs text-ink-500">Viewed {new Date(item.viewedAt).toLocaleString()}</p><span className="mt-3 inline-block text-sm font-semibold text-pulse-600">Continue →</span></Link>)}</div>}</div>}
          {tab==='glossary' && <div><h3 className="font-semibold text-ink-800">My Glossary</h3><form onSubmit={addGlossary} className="mt-4 grid gap-3 sm:grid-cols-2"><input required value={term} onChange={e=>setTerm(e.target.value)} placeholder="Medical term" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject or category" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><textarea required value={definition} onChange={e=>setDefinition(e.target.value)} placeholder="Definition or explanation" rows={3} className="rounded-lg border border-ink-200 px-3 py-2 text-sm sm:col-span-2"/><button className={`${primary} sm:col-span-2`}>Save term locally</button></form><input value={glossarySearch} onChange={e=>setGlossarySearch(e.target.value)} placeholder="Search your glossary" className="mt-4 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"/><div className="mt-3 grid gap-3 sm:grid-cols-2">{filteredGlossary.map(item=><article key={item.id} className={`rounded-xl border border-ink-100 ${preferences.compactCards ? 'p-3' : 'p-4'}`}><div className="flex justify-between gap-2"><h4 className="font-semibold text-ink-800">{item.term}</h4><button className="text-xs text-ink-400 hover:text-red-600" onClick={()=>persist({glossary:glossary.filter(x=>x.id!==item.id)})}>Delete</button></div><p className="mt-1 text-xs text-pulse-600">{item.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">{item.definition}</p></article>)}</div>{glossary.length===0&&<Empty text="Start building your own glossary of terms you want to remember."/>}</div>}
          {tab==='formulas' && <PersonalFormulaSheet />}
          {tab==='journal' && <ReflectionJournal />}
          {tab==='decks' && <div><h3 className="font-semibold text-ink-800">Custom flashcard decks</h3><form onSubmit={createDeck} className="mt-3 flex flex-col gap-2 sm:flex-row"><input required value={deckTitle} onChange={e=>setDeckTitle(e.target.value)} placeholder="New deck name" className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"/><button className={primary}>Create deck</button></form>{decks.length>0&&<><label className="mt-4 block text-sm font-medium text-ink-700">Choose a deck<select value={selectedDeck?.id??''} onChange={e=>{setDeckId(e.target.value);setShuffled([]);setCardIndex(0);}} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm">{decks.map(deck=><option key={deck.id} value={deck.id}>{deck.title} ({deck.cards.length})</option>)}</select></label><form onSubmit={addCard} className="mt-4 grid gap-2 sm:grid-cols-2"><textarea required value={front} onChange={e=>setFront(e.target.value)} placeholder="Front / question" rows={2} className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><textarea required value={back} onChange={e=>setBack(e.target.value)} placeholder="Back / answer" rows={2} className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><select value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)} className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><button className={primary}>Add flashcard</button></form><div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-sm text-ink-600">Difficulty filter<select value={cardFilter} onChange={e=>{setCardFilter(e.target.value as typeof cardFilter);setCardIndex(0);}} className="ml-2 rounded-lg border border-ink-200 bg-white px-2 py-1.5"><option value="all">All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><button className={btn} onClick={shuffleDeck}>Shuffle cards</button><button className={btn} onClick={()=>setShuffled([])}>Reset order</button><button className={`${btn} text-red-600`} onClick={()=>{persist({customDecks:decks.filter(deck=>deck.id!==selectedDeck?.id)});setDeckId('');setShuffled([]);}}>Delete deck</button></div><div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Practice card {filteredCards.length?Math.min(cardIndex+1,filteredCards.length):0} of {filteredCards.length}</p>{filteredCards.length===0?<p className="mt-3 text-sm text-ink-500">No cards match this filter. Add cards or choose another difficulty.</p>:<><p className="mt-4 font-semibold text-ink-800">{filteredCards[cardIndex%filteredCards.length].front}</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-pulse-600">Reveal answer</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">{filteredCards[cardIndex%filteredCards.length].back}</p></details><button className={`${primary} mt-4`} onClick={()=>setCardIndex(i=>(i+1)%filteredCards.length)}>Next card</button></>}</div></>}</div>}
          {tab==='planner' && <div><h3 className="font-semibold text-ink-800">Revision Planner</h3><p className="mt-1 text-sm text-ink-500">Suggests what to study next based on your missed questions and open tasks — no AI guesswork, just what's already in your queue.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-ink-100 p-4"><p className="text-xs text-ink-500">Suggested priority</p><p className="mt-1 font-semibold text-ink-800">{missed.length?'Review missed quiz questions':'Complete overdue study tasks'}</p><p className="mt-1 text-sm text-ink-500">{missed.length?`${missed.reduce((sum,item)=>sum+item.count,0)} question IDs are saved locally.`:`${dueTasks.length} unfinished tasks are due.`}</p><button className={`${primary} mt-3`} onClick={()=>setTab(missed.length?'mistakes':'overview')}>Open priority</button></div><div className="rounded-xl border border-ink-100 p-4"><p className="text-xs text-ink-500">Create next task</p><form onSubmit={addPlannerTask} className="mt-2 space-y-2"><input value={plannerGoal} onChange={e=>setPlannerGoal(e.target.value)} required placeholder="Topic to revise" className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"/><button className={primary}>Add to existing study plan</button></form></div></div><div className="mt-4 space-y-2">{dueTasks.slice(0,10).map(task=><div key={task.id} className="flex items-center gap-3 rounded-lg border border-ink-100 p-3"><span className="flex-1 text-sm text-ink-700">{task.text}</span><span className="text-xs text-ink-400">Due {task.date}</span></div>)}</div></div>}
          {tab==='history' && <div><h3 className="font-semibold text-ink-800">Study History</h3><p className="mt-1 text-sm text-ink-500">Built from sessions you log here plus focus time already tracked in Study Space. We can't recover study time that was never recorded.</p><form onSubmit={logSession} className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]"><input value={sessionTitle} onChange={e=>setSessionTitle(e.target.value)} aria-label="Session name" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><input type="number" min={1} max={600} value={sessionMinutes} onChange={e=>setSessionMinutes(Number(e.target.value))} aria-label="Session duration in minutes" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><button className={primary}>Log session</button></form><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Minutes this week" value={weekMinutes} helper="Local study records"/><Metric label="Sessions logged" value={sessions.length} helper="All time on this device"/><Metric label="Notes saved" value={notes.length} helper="Existing Study Space notes"/></div><div className="mt-4 space-y-2">{sessions.slice(0,20).map(session=><div key={session.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-ink-100 p-3"><div><p className="text-sm font-semibold text-ink-800">{session.title}</p><p className="text-xs text-ink-400">{new Date(session.date).toLocaleString()}</p></div><p className="text-sm font-semibold text-pulse-700">{session.minutes} min</p></div>)}</div>{sessions.length===0&&<Empty text="Log a session after studying to start your history."/>}<button className={`${btn} mt-4`} onClick={()=>downloadLocalFile(`cliniolab-weekly-report-${today()}.txt`, `CLINIOLAB WEEKLY STUDY REPORT\nWeek ending: ${today()}\nStudy minutes: ${weekMinutes}\nSessions logged: ${sessions.filter(s=>weekDays.includes(s.date.slice(0,10))).length}\nNotes saved: ${notes.length}\nGlossary terms: ${glossary.length}\nMissed question IDs: ${missed.reduce((sum,item)=>sum+item.count,0)}\nOverdue tasks: ${dueTasks.length}\n\nThis report includes only information saved in this browser.`,'text/plain;charset=utf-8')}>Export weekly report</button></div>}
          {tab==='notes' && <div><h3 className="font-semibold text-ink-800">Notes & Annotations</h3><p className="mt-1 text-sm text-ink-500">Pulls in your Study Space notes, plus any article annotations you save below.</p><div className="mt-3 flex flex-wrap gap-2"><button className={primary} onClick={exportNotes}>Export notes as Markdown</button><button className={btn} onClick={()=>setMessage(`${notes.length} existing notes are available for export.`)}>Count notes ({notes.length})</button></div><form onSubmit={addAnnotation} className="mt-5 grid gap-2"><input value={annotationTitle} onChange={e=>setAnnotationTitle(e.target.value)} placeholder="Article or note title" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><input value={annotationHref} onChange={e=>setAnnotationHref(e.target.value)} placeholder="Article URL path, e.g. /blog/example" className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><textarea required value={annotationBody} onChange={e=>setAnnotationBody(e.target.value)} placeholder="Your personal annotation, key point or question" rows={3} className="rounded-lg border border-ink-200 px-3 py-2 text-sm"/><button className={`${primary} justify-self-start`}>Save annotation locally</button></form><div className="mt-4 space-y-2">{annotations.map(item=><article key={item.id} className={`rounded-xl border border-ink-100 ${preferences.compactCards ? 'p-3' : 'p-4'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-ink-800">{item.title}</h4><Link className="text-xs text-pulse-600" href={item.href.startsWith('/')?item.href:'/blog'}>{item.href}</Link></div><button className="text-xs text-ink-400 hover:text-red-600" onClick={()=>persist({articleAnnotations:annotations.filter(a=>a.id!==item.id)})}>Delete</button></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">{item.body}</p></article>)}</div>{annotations.length===0&&<Empty text="Jot down a thought while reading — it's just for you, and never touches the published article."/>}</div>}
          {tab==='preferences' && <div><h3 className="font-semibold text-ink-800">Preferences</h3><p className="mt-1 text-sm text-ink-500">These only change how the tools on this page behave.</p><div className="mt-4 max-w-xl space-y-4"><label className="block text-sm text-ink-700">Default session length<select value={preferences.defaultSessionMinutes??25} onChange={e=>savePreferences({...preferences,defaultSessionMinutes:Number(e.target.value)})} className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2"><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={25}>25 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option></select></label><label className="block text-sm text-ink-700">Daily study target in minutes<input type="number" min={5} max={600} value={preferences.dailyTargetMinutes??30} onChange={e=>savePreferences({...preferences,dailyTargetMinutes:Math.max(5,Math.min(600,Number(e.target.value)||30))})} className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2"/></label><label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={Boolean(preferences.compactCards)} onChange={e=>savePreferences({...preferences,compactCards:e.target.checked})}/> Use compact cards in supported local tools</label><label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={preferences.showLocalReminders!==false} onChange={e=>savePreferences({...preferences,showLocalReminders:e.target.checked})}/> Show local revision reminders</label><div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Reminder</p><p className="mt-1 text-sm text-amber-800">{preferences.showLocalReminders===false?'Reminders are hidden by your preference.':overdueCount?`You have ${overdueCount} locally recorded item${overdueCount===1?'':'s'} to review. Open the planner when you return.`:'No locally recorded overdue items right now.'}</p><p className="mt-2 text-xs text-amber-700">This is just a note on the page — not a push notification.</p></div></div></div>}
          {tab==='backup' && <div><h3 className="font-semibold text-ink-800">Backup & Restore</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">Download everything on this page — your Study Space data, decks, glossary, annotations, session history, preferences and recently viewed pages — as one file. Keep it somewhere safe; restoring will replace what's currently saved on this device.</p><div className="mt-4 flex flex-wrap gap-2"><button className={primary} onClick={exportBackup}>Download full backup</button><label className={`${btn} cursor-pointer`}>Restore from JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={importBackup}/></label></div><p className="mt-3 text-xs text-ink-400">Only works with a backup exported from Cliniolab. Nothing is uploaded — the file stays on your device.</p></div>}
        </>}
      </div>
    </Card>
  </section>;
}

function Metric({label,value,helper}:{label:string;value:string|number;helper:string}) { return <div className="rounded-xl border border-ink-100 bg-white p-4"><p className="text-xs font-medium text-ink-500">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-ink-900">{value}</p><p className="mt-1 text-xs text-ink-400">{helper}</p></div>; }
function Empty({text}:{text:string}) { return <div className="mt-4 rounded-xl border border-dashed border-ink-200 p-5 text-sm leading-6 text-ink-500">{text}</div>; }
