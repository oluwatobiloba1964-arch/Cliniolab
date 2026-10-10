// File: src/components/study/LocalClinicalPractice.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

type CaseOption = { label: string; correct: boolean; feedback: string };
type ClinicalCase = { id: string; title: string; setting: string; prompt: string; options: CaseOption[]; keyPoint: string };
type ClinicalCalculation = { id: string; prompt: string; answer: number; tolerance: number; unit: string; explanation: string };
type OsceStation = { id: string; title: string; steps: string[] };
type DailyPracticeSet = { date: string; cases: ClinicalCase[]; calculations: ClinicalCalculation[]; osceStations: OsceStation[] };

const CACHE_KEY = 'cliniolab:daily-clinical-practice';

/** Africa/Lagos (UTC+1, no DST) calendar day, matching the server's pick. */
function lagosDateString(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readCache(): DailyPracticeSet | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyPracticeSet;
    return parsed.date === lagosDateString() ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(set: DailyPracticeSet) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(set));
  } catch {
    // Storage unavailable (private mode, quota, etc.) - practice still works, just refetches next time.
  }
}

export function LocalClinicalPractice() {
  // Cached set is read once on mount; a fresh one is fetched only when
  // today's date isn't already cached, so most visits make no request.
  const [data, setData] = useState<DailyPracticeSet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch('/api/clinical-practice/today')
      .then((res) => (res.ok ? res.json() : null))
      .then((set: DailyPracticeSet | null) => {
        if (cancelled || !set) return;
        writeCache(set);
        setData(set);
      })
      .catch(() => {
        // Offline/first load with no cache: component just shows nothing to pick from below.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cases = data?.cases ?? [];
  const calculations = data?.calculations ?? [];
  const osceStations = data?.osceStations ?? [];

  const [tab, setTab] = useState<'cases' | 'osce' | 'calculations'>('cases');
  const [caseIndex, setCaseIndex] = useState(0);
  const [caseAnswers, setCaseAnswers] = useState<Record<number, number>>({});
  const [stationIndex, setStationIndex] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [calcIndex, setCalcIndex] = useState(0);
  const [calcInput, setCalcInput] = useState('');
  const [calcSubmitted, setCalcSubmitted] = useState(false);

  const activeCase = cases[caseIndex];
  const activeStation = osceStations[stationIndex];
  const activeCalc = calculations[calcIndex];
  const stationProgress = useMemo(
    () => (activeStation ? activeStation.steps.filter((step) => checkedSteps[`${stationIndex}:${step}`]).length : 0),
    [activeStation, checkedSteps, stationIndex]
  );

  return (
    <section className="mt-8" aria-labelledby="clinical-practice-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Practice lab</p>
        <h2 id="clinical-practice-heading" className="mt-1 font-display text-xl font-semibold text-ink-900">Clinical practice, OSCEs and calculations</h2>
        <p className="mt-1 text-sm text-ink-500">New cases, OSCE stations and calculations every day. Follow your school&rsquo;s guidance and local clinical protocols.</p>
      </div>
      <Card className="overflow-hidden p-0">
        {loading && !data ? (
          <div className="p-6 text-sm text-ink-400">Loading today&rsquo;s practice set…</div>
        ) : !activeCase || !activeStation || !activeCalc ? (
          <div className="p-6 text-sm text-ink-400">Today&rsquo;s practice set isn&rsquo;t available right now. Please try again shortly.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-px bg-ink-100">
              {([['cases', 'Clinical cases'], ['osce', 'OSCE checklist'], ['calculations', 'Calculations']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} className={`px-2 py-3 text-xs font-semibold transition sm:text-sm ${tab === key ? 'bg-white text-pulse-700' : 'bg-ink-50 text-ink-500 hover:bg-white'}`}>{label}</button>)}
            </div>
            <div className="p-4 sm:p-6">
              {tab === 'cases' && <div>
                <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700">Case {caseIndex + 1} of {cases.length}</span><span className="text-xs text-ink-400">{activeCase.setting}</span></div>
                <h3 className="mt-3 font-display text-lg font-semibold text-ink-900">{activeCase.title}</h3><p className="mt-2 text-sm leading-6 text-ink-600">{activeCase.prompt}</p>
                <div className="mt-4 space-y-2">{activeCase.options.map((option, index) => { const selected = caseAnswers[caseIndex] === index; return <button key={option.label} type="button" onClick={() => setCaseAnswers((prev) => ({ ...prev, [caseIndex]: index }))} className={`w-full rounded-xl border p-3 text-left text-sm transition ${selected ? option.correct ? 'border-pulse-300 bg-pulse-50 text-pulse-900' : 'border-flag-200 bg-flag-50 text-ink-800' : 'border-ink-100 hover:border-pulse-200 hover:bg-ink-50'}`}><span className="mr-2 font-mono text-xs text-ink-400">{String.fromCharCode(65 + index)}.</span>{option.label}</button>; })}</div>
                {caseAnswers[caseIndex] !== undefined && <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50 p-4"><p className="text-sm font-semibold text-ink-800">{activeCase.options[caseAnswers[caseIndex]].correct ? 'Best response' : 'Review the priority'}</p><p className="mt-1 text-sm leading-6 text-ink-600">{activeCase.options[caseAnswers[caseIndex]].feedback}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Key point</p><p className="mt-1 text-sm leading-6 text-ink-600">{activeCase.keyPoint}</p></div>}
                <div className="mt-4 flex justify-between gap-2"><button type="button" onClick={() => setCaseIndex((i) => (i + cases.length - 1) % cases.length)} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700">Previous case</button><button type="button" onClick={() => setCaseIndex((i) => (i + 1) % cases.length)} className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white">Next case</button></div>
              </div>}
              {tab === 'osce' && <div>
                <label className="block text-sm font-semibold text-ink-800" htmlFor="osce-station">Choose a station</label><select id="osce-station" value={stationIndex} onChange={(e) => setStationIndex(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm sm:max-w-sm">{osceStations.map((station, index) => <option key={station.title} value={index}>{station.title}</option>)}</select>
                <div className="mt-4 flex items-center justify-between gap-3"><h3 className="font-display text-lg font-semibold text-ink-900">{activeStation.title}</h3><span className="text-xs font-semibold text-pulse-700">{stationProgress}/{activeStation.steps.length} checked</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-pulse-500" style={{ width: `${stationProgress / activeStation.steps.length * 100}%` }} /></div>
                <ul className="mt-4 space-y-2">{activeStation.steps.map((step) => <li key={step} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3"><input type="checkbox" checked={!!checkedSteps[`${stationIndex}:${step}`]} onChange={(e) => setCheckedSteps((prev) => ({ ...prev, [`${stationIndex}:${step}`]: e.target.checked }))} aria-label={step} className="mt-1" /><span className={`text-sm leading-6 ${checkedSteps[`${stationIndex}:${step}`] ? 'text-ink-400 line-through' : 'text-ink-700'}`}>{step}</span></li>)}</ul>
                <p className="mt-3 text-xs leading-5 text-ink-400">Use the checklist for practice only. Your institution's marking scheme and local policy take precedence.</p>
              </div>}
              {tab === 'calculations' && <div>
                <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700">Question {calcIndex + 1} of {calculations.length}</span><button type="button" onClick={() => { setCalcIndex((i) => (i + 1) % calculations.length); setCalcInput(''); setCalcSubmitted(false); }} className="text-xs font-semibold text-pulse-700">Skip question →</button></div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">Clinical calculation</h3><p className="mt-2 text-sm leading-6 text-ink-600">{activeCalc.prompt}</p>
                <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); setCalcSubmitted(true); }}><label className="sr-only" htmlFor="clinical-calculation-answer">Your numerical answer</label><input id="clinical-calculation-answer" inputMode="decimal" type="number" step="any" value={calcInput} onChange={(e) => { setCalcInput(e.target.value); setCalcSubmitted(false); }} placeholder={`Answer in ${activeCalc.unit}`} className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm" /><button className="rounded-lg bg-pulse-600 px-4 py-2 text-sm font-semibold text-white">Check answer</button></form>
                {calcSubmitted && <div className={`mt-4 rounded-xl border p-4 ${Math.abs(Number(calcInput) - activeCalc.answer) < activeCalc.tolerance ? 'border-pulse-200 bg-pulse-50' : 'border-flag-100 bg-flag-50'}`}><p className="text-sm font-semibold text-ink-800">{Math.abs(Number(calcInput) - activeCalc.answer) < activeCalc.tolerance ? 'Correct' : `Review: answer is ${activeCalc.answer} ${activeCalc.unit}`}</p><p className="mt-1 text-sm leading-6 text-ink-600">{activeCalc.explanation}</p></div>}
                <p className="mt-4 text-xs leading-5 text-ink-400">Practice arithmetic only. Always independently verify medication orders, units, safe dose ranges and calculations before clinical use.</p>
                <button type="button" onClick={() => { setCalcIndex((i) => (i + 1) % calculations.length); setCalcInput(''); setCalcSubmitted(false); }} className="mt-4 rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700">Next calculation →</button>
              </div>}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
