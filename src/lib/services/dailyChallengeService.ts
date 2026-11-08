// File: src/lib/services/dailyChallengeService.ts
// Browser-only daily clinical challenge. Pure client-side: no fetch, no
// API call, no database read. A fixed bank of 12-question clinical
// scenarios is rotated deterministically by day-of-year so every visitor
// on the same day sees the same set of questions, and a streak counter
// in localStorage rewards coming back daily.

export type DailyChallengeQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  topic: string;
};

export const DAILY_CHALLENGE_BANK: readonly DailyChallengeQuestion[] = [
  {
    id: 'dc-001',
    topic: 'Cardiology',
    prompt: 'A 58-year-old man presents with crushing central chest pain radiating to the left arm, diaphoresis, and dyspnoea. ECG shows ST elevation in leads II, III and aVF. Which coronary artery is most likely occluded?',
    options: ['Left anterior descending', 'Right coronary artery', 'Left circumflex', 'Left main'],
    correctIndex: 1,
    rationale: 'Inferior wall STEMI (ST elevation in II, III, aVF) is most often caused by occlusion of the right coronary artery, which supplies the inferior wall of the left ventricle.',
  },
  {
    id: 'dc-002',
    topic: 'Respiratory',
    prompt: 'A 24-year-old asthmatic presents with severe breathlessness, silent chest, cyanosis and cannot complete sentences. PEFR is 35% of predicted. What is the most appropriate immediate action?',
    options: ['Oral theophylline', 'Nebulised salbutamol with oxygen and IV hydrocortisone', 'Inhaled salbutamol spacer and discharge', 'Chest X-ray'],
    correctIndex: 1,
    rationale: 'Life-threatening asthma with a silent chest requires high-flow oxygen, nebulised beta-2 agonist, systemic steroids, and consideration of IV magnesium or ICU. Discharge or X-ray first would delay life-saving treatment.',
  },
  {
    id: 'dc-003',
    topic: 'Pharmacology',
    prompt: 'A patient on warfarin with an INR of 8.0 has no active bleeding. According to current guidelines, the most appropriate first-line action is to:',
    options: ['Stop warfarin and give IV vitamin K 10 mg', 'Stop warfarin, give oral vitamin K 1-5 mg', 'Continue warfarin at the same dose', 'Administer fresh frozen plasma immediately'],
    correctIndex: 1,
    rationale: 'For an INR above 8 with no bleeding, warfarin should be withheld and oral vitamin K 1-5 mg given. IV vitamin K and FFP are reserved for major bleeding or very high INR with bleeding risk.',
  },
  {
    id: 'dc-004',
    topic: 'Paediatrics',
    prompt: 'A 5-minute-old newborn has a heart rate of 90 beats per minute, is gasping, has poor muscle tone, and is centrally cyanosed. The APGAR score is:',
    options: ['2', '3', '4', '5'],
    correctIndex: 1,
    rationale: 'HR <100 = 1, gasping/irregular = 1, flaccid tone = 0, no reflex response = 0, central cyanosis = 0. Total = 2. Re-evaluating: HR of 90 gives 1 point; gasping respirations = 1; poor tone = 0; no response = 0; cyanosis = 0 — total 2. The correct APGAR is 2.',
  },
  {
    id: 'dc-005',
    topic: 'Neurology',
    prompt: 'A 67-year-old woman is brought in with sudden right-sided weakness and slurred speech. The FAST test is positive. Time of symptom onset was 1.5 hours ago. CT brain shows no haemorrhage. The most appropriate definitive treatment is:',
    options: ['IV thrombolysis with alteplase', 'Antiplatelet therapy with aspirin', 'Watchful waiting and repeat CT', 'Anticoagulation with heparin'],
    correctIndex: 0,
    rationale: 'Within 4.5 hours of ischaemic stroke onset, with no haemorrhage on CT and no contraindications, IV thrombolysis with alteplase is the standard of care and improves functional outcomes.',
  },
  {
    id: 'dc-006',
    topic: 'Endocrinology',
    prompt: 'A 32-year-old woman with type 1 diabetes presents with vomiting, abdominal pain and deep sighing respirations. Blood glucose is 28 mmol/L, blood ketones 6.2 mmol/L, venous pH 7.18. What is the single most important initial fluid?',
    options: ['0.9% sodium chloride 1L stat', '5% dextrose', 'Hartmann\'s solution 500 mL over 1 hour', 'Oral rehydration salts'],
    correctIndex: 0,
    rationale: 'DKA requires immediate volume resuscitation with 0.9% sodium chloride 1L over the first hour, followed by insulin infusion. Dextrose is added only when blood glucose falls below ~14 mmol/L.',
  },
  {
    id: 'dc-007',
    topic: 'Renal',
    prompt: 'A 70-year-old man with benign prostatic hyperplasia presents with acute lower abdominal pain and inability to pass urine for 12 hours. On examination, the bladder is palpable and tender. The first-line intervention is:',
    options: ['IV antibiotics', 'Immediate urethral catheterisation', 'IV furosemide', 'CT urogram'],
    correctIndex: 1,
    rationale: 'Acute urinary retention with a palpable bladder requires immediate urethral catheterisation to decompress the bladder and relieve pain. Imaging or diuretics would delay definitive relief.',
  },
  {
    id: 'dc-008',
    topic: 'Gastroenterology',
    prompt: 'A 45-year-old with known liver cirrhosis presents with haematemesis. Which vasoactive drug should be started immediately while arranging endoscopy?',
    options: ['Octreotide (or terlipressin)', 'Adrenaline IV bolus', 'Tranexamic acid alone', 'Omeprazole alone'],
    correctIndex: 0,
    rationale: 'In suspected variceal bleeding, a vasoactive agent such as octreotide or terlipressin should be started immediately to reduce portal pressure while endoscopy is arranged. Antibiotics (e.g. ciprofloxacin) are also indicated.',
  },
  {
    id: 'dc-009',
    topic: 'Infectious disease',
    prompt: 'A 19-year-old university student presents with fever, neck stiffness, photophobia and a non-blanching petechial rash. What is the most appropriate immediate management?',
    options: ['Lumbar puncture first', 'IV ceftriaxone 2g immediately, then LP if no contraindication', 'Oral amoxicillin and discharge', 'CT brain before any treatment'],
    correctIndex: 1,
    rationale: 'In suspected bacterial meningitis with a petechial rash, IV antibiotics (ceftriaxone 2g) must be given within 30 minutes, ideally before but not delayed by investigations such as LP or CT.',
  },
  {
    id: 'dc-010',
    topic: 'Obstetrics',
    prompt: 'A pregnant woman at 38 weeks gestation presents with painless, bright red vaginal bleeding. The fetal heart rate is normal. What is the most likely diagnosis?',
    options: ['Placental abruption', 'Placenta praevia', 'Vasa praevia', 'Cervical polyp'],
    correctIndex: 1,
    rationale: 'Painless, bright red vaginal bleeding at term with a normal fetal heart rate is the classic presentation of placenta praevia. Abruption typically presents with pain and uterine tenderness.',
  },
  {
    id: 'dc-011',
    topic: 'Psychiatry',
    prompt: 'A 25-year-old man presents with pressured speech, reduced need for sleep, grandiose ideas and reckless spending for the past 5 days. He feels "fantastic" and refuses treatment. The most likely diagnosis is:',
    options: ['Acute mania', 'Schizophrenia first episode', 'Hyperthyroidism', 'Panic disorder'],
    correctIndex: 0,
    rationale: 'Reduced sleep need, pressured speech, grandiosity and risky behaviour lasting days are classical features of a manic episode. Treatment includes a mood stabiliser and often an atypical antipsychotic.',
  },
  {
    id: 'dc-012',
    topic: 'Trauma',
    prompt: 'A motorcyclist arrives with significant mechanism of injury. He is tachypnoeic, hypoxic on room air, and has decreased air entry and dullness to percussion on the right side. What is the most likely diagnosis?',
    options: ['Tension pneumothorax', 'Massive haemothorax', 'Flail chest', 'Cardiac tamponade'],
    correctIndex: 1,
    rationale: 'Decreased air entry combined with dullness to percussion suggests fluid (blood) in the pleural space — a massive haemothorax. A tension pneumothorax would produce hyperresonance, not dullness.',
  },
] as const;

const DAILY_CHALLENGE_STREAK_KEY = 'cliniolab_daily_challenge_streak_v1';

export type DailyChallengeStreak = {
  lastPlayedKey: string | null; // YYYY-MM-DD
  currentStreak: number;
  longestStreak: number;
  history: string[]; // last 30 day-keys played
};

/** Day index used to deterministically pick today's questions. */
export function dayOfYearKey(date: Date = new Date()): string {
  // Use the local calendar day so a streak is defined per calendar day.
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic selection of 12 questions for today. */
export function getTodaysDailyChallenge(date: Date = new Date()): DailyChallengeQuestion[] {
  const key = dayOfYearKey(date);
  // Hash the day-key into a deterministic starting offset.
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const start = hash % DAILY_CHALLENGE_BANK.length;
  // Return the bank rotated so today's selection starts at `start`.
  // The bank is exactly 12 questions long, so a single rotation returns all 12.
  const rotated = [
    ...DAILY_CHALLENGE_BANK.slice(start),
    ...DAILY_CHALLENGE_BANK.slice(0, start),
  ];
  return rotated;
}

export function readStreak(): DailyChallengeStreak {
  if (typeof window === 'undefined') return { lastPlayedKey: null, currentStreak: 0, longestStreak: 0, history: [] };
  try {
    const raw = window.localStorage.getItem(DAILY_CHALLENGE_STREAK_KEY);
    if (!raw) return { lastPlayedKey: null, currentStreak: 0, longestStreak: 0, history: [] };
    const parsed = JSON.parse(raw) as Partial<DailyChallengeStreak>;
    return {
      lastPlayedKey: typeof parsed.lastPlayedKey === 'string' ? parsed.lastPlayedKey : null,
      currentStreak: Number.isFinite(parsed.currentStreak) ? (parsed.currentStreak as number) : 0,
      longestStreak: Number.isFinite(parsed.longestStreak) ? (parsed.longestStreak as number) : 0,
      history: Array.isArray(parsed.history) ? parsed.history.filter((h) => typeof h === 'string').slice(0, 30) : [],
    };
  } catch {
    return { lastPlayedKey: null, currentStreak: 0, longestStreak: 0, history: [] };
  }
}

function writeStreak(state: DailyChallengeStreak): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DAILY_CHALLENGE_STREAK_KEY, JSON.stringify(state));
  } catch {
    // Best-effort storage; streaks are a nicety and must never break the UI.
  }
}

/** Returns true if the streak was incremented (new day), false if already played today. */
export function markDailyChallengePlayed(date: Date = new Date()): boolean {
  const today = dayOfYearKey(date);
  const state = readStreak();
  if (state.lastPlayedKey === today) return false;

  // Was yesterday played? If so, increment; otherwise reset to 1.
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayOfYearKey(yesterday);

  const currentStreak = state.lastPlayedKey === yesterdayKey ? state.currentStreak + 1 : 1;
  const longestStreak = Math.max(state.longestStreak, currentStreak);
  const history = Array.from(new Set([today, ...state.history])).slice(0, 30);

  writeStreak({
    lastPlayedKey: today,
    currentStreak,
    longestStreak,
    history,
  });
  return true;
}

export function hasPlayedToday(date: Date = new Date()): boolean {
  return readStreak().lastPlayedKey === dayOfYearKey(date);
}
