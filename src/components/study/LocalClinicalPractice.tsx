'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

type CaseOption = { label: string; correct: boolean; feedback: string };
type ClinicalCase = { title: string; setting: string; prompt: string; options: CaseOption[]; keyPoint: string };
const cases: ClinicalCase[] = [
  { title: 'Deteriorating adult patient', setting: 'Medical ward', prompt: 'A patient becomes acutely confused. Respiratory rate is 30/min, oxygen saturation is 88% on room air, and the patient looks exhausted. What should you do first?', options: [
    { label: 'Assess ABCDE, call for urgent help, and support immediate oxygenation according to protocol', correct: true, feedback: 'This prioritizes airway, breathing and circulation while activating help for acute deterioration.' },
    { label: 'Finish documenting the last set of observations before reassessing', correct: false, feedback: 'Documentation matters, but acute respiratory compromise needs immediate assessment and escalation.' },
    { label: 'Leave the patient to collect the full medical history', correct: false, feedback: 'Do not leave an unstable patient unattended to complete a history.' },
    { label: 'Offer oral fluids and reassess in thirty minutes', correct: false, feedback: 'Oral fluids do not address hypoxaemia and delay urgent assessment.' },
  ], keyPoint: 'Use an ABCDE approach, call for assistance early, repeat observations and follow local escalation and oxygen protocols.' },
  { title: 'Possible hypoglycaemia', setting: 'Outpatient clinic', prompt: 'A conscious adult with diabetes is shaky and sweating. A capillary glucose reading is 3.1 mmol/L. They can swallow safely. What is the most appropriate immediate action?', options: [
    { label: 'Give a fast-acting oral glucose source according to the local hypoglycaemia protocol and recheck glucose', correct: true, feedback: 'A conscious patient who can swallow safely can usually receive fast-acting oral carbohydrate, followed by a repeat glucose check.' },
    { label: 'Give the next scheduled insulin dose immediately', correct: false, feedback: 'Additional insulin may worsen hypoglycaemia and is not the immediate response.' },
    { label: 'Ask the patient to walk around to improve circulation', correct: false, feedback: 'Activity can increase glucose use and does not correct the low glucose safely.' },
    { label: 'Give food by mouth even if the patient becomes drowsy and cannot swallow', correct: false, feedback: 'Oral intake is unsafe when consciousness or swallowing is impaired because of aspiration risk.' },
  ], keyPoint: 'Follow the local protocol, confirm the patient can swallow, treat promptly and recheck glucose. If swallowing is unsafe or consciousness is reduced, use the emergency pathway.' },
  { title: 'Postoperative breathing concern', setting: 'Surgical ward', prompt: 'Two hours after surgery, a patient suddenly develops severe shortness of breath and chest discomfort. What is the priority?', options: [
    { label: 'Stay with the patient, assess ABCDE, activate urgent clinical assistance and monitor vital signs', correct: true, feedback: 'Sudden severe breathlessness may signal a life-threatening complication and requires immediate assessment and escalation.' },
    { label: 'Encourage the patient to sleep and reassess at the next routine round', correct: false, feedback: 'Waiting could delay treatment of a serious postoperative complication.' },
    { label: 'Give an oral analgesic first and reassess after it works', correct: false, feedback: 'Pain relief alone does not address the acute breathing problem.' },
    { label: 'Ask the patient to walk to the nurses station', correct: false, feedback: 'Exertion is unsafe while the patient is acutely breathless and unstable.' },
  ], keyPoint: 'Recognize acute deterioration, get help immediately and continue monitoring while following local emergency protocols.' },
];

const calculations = [
  { prompt: 'An order is for 500 mg. Available tablets contain 250 mg each. How many tablets are required?', answer: 2, tolerance: 0.11, unit: 'tablets', explanation: '500 mg ÷ 250 mg per tablet = 2 tablets.' },
  { prompt: 'Infuse 1,000 mL over 8 hours using an infusion pump. What rate is required?', answer: 125, tolerance: 0.11, unit: 'mL/hour', explanation: '1,000 mL ÷ 8 hours = 125 mL/hour.' },
  { prompt: 'A fluid order is 500 mL over 4 hours. The giving set delivers 20 drops/mL. Calculate the approximate rate in drops/minute.', answer: 42, tolerance: 0.51, unit: 'drops/min', explanation: '(500 mL × 20 drops/mL) ÷ (4 × 60 minutes) = 41.7, rounded to 42 drops/minute.' },
  { prompt: 'A patient weighs 60 kg. The prescribed dose is 5 mg/kg. What is the calculated dose?', answer: 300, tolerance: 0.11, unit: 'mg', explanation: '60 kg × 5 mg/kg = 300 mg. Confirm the order, safe dose range and local medication policy before administration.' },
  { prompt: 'A bottle contains 125 mg in 5 mL. The prescribed dose is 250 mg. What volume contains the prescribed dose?', answer: 10, tolerance: 0.11, unit: 'mL', explanation: '(250 mg ÷ 125 mg) × 5 mL = 10 mL.' },
];

const osceStations = [
  { title: 'Medication administration', steps: ['Perform hand hygiene and introduce yourself', 'Confirm patient identity using approved identifiers', 'Check allergy status and clarify any uncertainty', 'Verify medicine, dose, route, time and relevant observations', 'Explain the medicine and obtain consent', 'Administer using aseptic and safe technique', 'Document administration and monitor the response'] },
  { title: 'Vital signs and escalation', steps: ['Perform hand hygiene and explain the procedure', 'Confirm identity and obtain consent', 'Measure and record observations accurately', 'Compare findings with expected range and baseline', 'Recognize abnormal findings and repeat if appropriate', 'Escalate deterioration promptly using local protocol', 'Document findings, actions and response'] },
  { title: 'Wound dressing', steps: ['Explain the procedure, obtain consent and provide privacy', 'Perform hand hygiene and prepare equipment', 'Assess pain and the wound before dressing', 'Use aseptic non-touch technique as indicated', 'Dispose of waste and sharps safely', 'Apply and secure the appropriate dressing', 'Document wound findings and patient tolerance'] },
];

export function LocalClinicalPractice() {
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
  const stationProgress = useMemo(() => activeStation.steps.filter((step) => checkedSteps[`${stationIndex}:${step}`]).length, [activeStation, checkedSteps, stationIndex]);

  return (
    <section className="mt-8" aria-labelledby="clinical-practice-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pulse-600">Practice lab</p>
        <h2 id="clinical-practice-heading" className="mt-1 font-display text-xl font-semibold text-ink-900">Clinical practice, OSCEs and calculations</h2>
        <p className="mt-1 text-sm text-ink-500">Interactive starter practice runs in your browser and uses no database or API requests. Follow your school's guidance and local clinical protocols.</p>
      </div>
      <Card className="overflow-hidden p-0">
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
      </Card>
    </section>
  );
}
