// File: src/lib/data/mnemonics.ts
// Hand-curated nursing & clinical mnemonics. Pure client-side: no fetch,
// no API call, no database read. Each mnemonic has a title, the
// mnemonic letters expanded, a short clinical note, and a category.

export type MnemonicCategory = 'Emergency' | 'Pharmacology' | 'Anatomy' | 'Paediatrics' | 'Obstetrics' | 'Cardiology' | 'Psychiatry' | 'Respiratory';

export type Mnemonic = {
  id: string;
  title: string;
  category: MnemonicCategory;
  letters: { letter: string; word: string; detail: string }[];
  note: string;
};

export const MNEMONICS: readonly Mnemonic[] = [
  {
    id: 'm-mona',
    title: 'MONA',
    category: 'Cardiology',
    letters: [
      { letter: 'M', word: 'Morphine', detail: 'For chest pain refractory to nitrates.' },
      { letter: 'O', word: 'Oxygen', detail: 'If SpO2 < 94% or in respiratory distress.' },
      { letter: 'N', word: 'Nitrates', detail: 'Sublingual GTN for vasodilation.' },
      { letter: 'A', word: 'Aspirin', detail: '300 mg chewed immediately.' },
    ],
    note: 'Acute coronary syndrome first-line therapy. Often preceded by dual antiplatelet therapy (DAPT) and anticoagulation.',
  },
  {
    id: 'm-fast',
    title: 'FAST',
    category: 'Emergency',
    letters: [
      { letter: 'F', word: 'Face', detail: 'Facial droop — ask the patient to smile.' },
      { letter: 'A', word: 'Arms', detail: 'Arm drift — both arms raised.' },
      { letter: 'S', word: 'Speech', detail: 'Slurred or strange speech.' },
      { letter: 'T', word: 'Time', detail: 'Time of onset — call for emergency help immediately.' },
    ],
    note: 'Pre-hospital stroke recognition. Time of onset decides thrombolysis eligibility (within 4.5 h for IV alteplase).',
  },
  {
    id: 'm-mudpiles',
    title: 'MUDPILES',
    category: 'Emergency',
    letters: [
      { letter: 'M', word: 'Methanol', detail: 'Antifreeze, paint thinner.' },
      { letter: 'U', word: 'Uremia', detail: 'Renal failure.' },
      { letter: 'D', word: 'Diabetic ketoacidosis', detail: 'Check glucose and ketones.' },
      { letter: 'P', word: 'Propylene glycol', detail: 'Often from infusions like lorazepam.' },
      { letter: 'I', word: 'Iron / Isoniazid', detail: 'Overdose history.' },
      { letter: 'L', word: 'Lactic acidosis', detail: 'Shock, sepsis.' },
      { letter: 'E', word: 'Ethylene glycol', detail: 'Antifreeze.' },
      { letter: 'S', word: 'Salicylates', detail: 'Aspirin overdose.' },
    ],
    note: 'High anion-gap metabolic acidosis differential.',
  },
  {
    id: 'm-apgar',
    title: 'APGAR',
    category: 'Paediatrics',
    letters: [
      { letter: 'A', word: 'Appearance', detail: 'Skin colour (blue/pale, blue extremities, pink).' },
      { letter: 'P', word: 'Pulse', detail: 'Heart rate (0, <100, >100 bpm).' },
      { letter: 'G', word: 'Grimace', detail: 'Reflex irritability on suction.' },
      { letter: 'A', word: 'Activity', detail: 'Muscle tone (flaccid, some flexion, active).' },
      { letter: 'R', word: 'Respiration', detail: 'Effort and cry (absent, slow/weak, strong).' },
    ],
    note: 'Newborn assessment at 1 and 5 minutes. Score 7-10 reassuring, 4-6 moderately depressed, 0-3 severely depressed.',
  },
  {
    id: 'm-abcde',
    title: 'ABCDE',
    category: 'Emergency',
    letters: [
      { letter: 'A', word: 'Airway', detail: 'Patency with cervical spine control in trauma.' },
      { letter: 'B', word: 'Breathing', detail: 'Rate, oxygen saturation, chest movement.' },
      { letter: 'C', word: 'Circulation', detail: 'Pulse, blood pressure, capillary refill.' },
      { letter: 'D', word: 'Disability', detail: 'GCS, pupils, blood glucose.' },
      { letter: 'E', word: 'Exposure', detail: 'Full history and exam while protecting dignity and warmth.' },
    ],
    note: 'Systematic primary survey for critically ill or trauma patients.',
  },
  {
    id: 'm-ride',
    title: 'RIDE',
    category: 'Pharmacology',
    letters: [
      { letter: 'R', word: 'Receptor', detail: 'Where the drug binds.' },
      { letter: 'I', word: 'Ion channel', detail: 'Membrane conductance.' },
      { letter: 'D', word: 'Drug-enzyme', detail: 'Inhibition or activation.' },
      { letter: 'E', word: 'Carrier molecule', detail: 'Transporters.' },
    ],
    note: 'Four broad drug targets — the answer to "what does a receptor/channel/carrier/enzyme do" questions.',
  },
  {
    id: 'm-sludge',
    title: 'SLUDGE',
    category: 'Pharmacology',
    letters: [
      { letter: 'S', word: 'Salivation', detail: 'Excessive drooling.' },
      { letter: 'L', word: 'Lacrimation', detail: 'Tearing.' },
      { letter: 'U', word: 'Urination', detail: 'Incontinence.' },
      { letter: 'D', word: 'Diarrhoea', detail: 'GI hypermotility.' },
      { letter: 'G', word: 'GI cramps', detail: 'Cramping abdominal pain.' },
      { letter: 'E', word: 'Emesis', detail: 'Vomiting.' },
    ],
    note: 'Cholinergic toxidrome from organophosphates or nerve agents. Treat with atropine and pralidoxime.',
  },
  {
    id: 'm-sampls',
    title: 'SAMPLE',
    category: 'Emergency',
    letters: [
      { letter: 'S', word: 'Symptoms', detail: 'Chief complaint.' },
      { letter: 'A', word: 'Allergies', detail: 'Drugs, foods, latex.' },
      { letter: 'M', word: 'Medications', detail: 'Including over-the-counter.' },
      { letter: 'P', word: 'Past medical history', detail: 'Relevant conditions.' },
      { letter: 'L', word: 'Last oral intake', detail: 'Last meal or fluids.' },
      { letter: 'E', word: 'Events leading up', detail: 'Onset and timeline.' },
    ],
    note: 'Structured history taking for trauma or emergency presentations.',
  },
  {
    id: 'm-pqrs',
    title: 'PQRST',
    category: 'Cardiology',
    letters: [
      { letter: 'P', word: 'Provocation/Palliation', detail: 'What brings it on or eases it.' },
      { letter: 'Q', word: 'Quality', detail: 'Dull, sharp, burning, crushing.' },
      { letter: 'R', word: 'Region/Radiation', detail: 'Location and where it spreads.' },
      { letter: 'S', word: 'Severity', detail: '0-10 scale.' },
      { letter: 'T', word: 'Time', detail: 'Onset, duration, pattern.' },
    ],
    note: 'Pain assessment mnemonic for any symptom, especially chest pain.',
  },
  {
    id: 'm-drip',
    title: 'DRIP',
    category: 'Pharmacology',
    letters: [
      { letter: 'D', word: 'Digoxin', detail: 'For atrial fibrillation rate control.' },
      { letter: 'R', word: 'Rifampicin', detail: 'Induces hepatic enzymes.' },
      { letter: 'I', word: 'Isoniazid', detail: 'TB therapy; peripheral neuropathy risk.' },
      { letter: 'P', word: 'Phenytoin', detail: 'Zero-order kinetics at therapeutic doses.' },
    ],
    note: 'Common drugs with narrow therapeutic windows — monitor levels and signs of toxicity.',
  },
  {
    id: 'm-critical-care-mw',
    title: 'ABC of Burns',
    category: 'Emergency',
    letters: [
      { letter: 'A', word: 'Airway', detail: 'Look for inhalational injury, soot in sputum.' },
      { letter: 'B', word: 'Breathing', detail: 'Look for circumferential chest burns.' },
      { letter: 'C', word: 'Circulation', detail: 'Parkland formula for fluid resuscitation.' },
    ],
    note: 'Airway, breathing, circulation first in major burns, then estimate %TBSA (rule of nines) and calculate fluids.',
  },
  {
    id: 'm-simplified-mmf',
    title: 'MMF',
    category: 'Pharmacology',
    letters: [
      { letter: 'M', word: 'Mycophenolate mofetil', detail: 'Immunosuppressant post-transplant.' },
      { letter: 'M', word: 'Methotrexate', detail: 'Folate antagonist.' },
      { letter: 'F', word: '5-Fluorouracil', detail: 'Anti-metabolite chemotherapy.' },
    ],
    note: 'Antimetabolite drugs — commonly asked in pharmacology exams.',
  },
  {
    id: 'm-bewitching-6',
    title: 'Six "B"\'s of Bradycardia',
    category: 'Cardiology',
    letters: [
      { letter: 'B', word: 'Beta-blockers', detail: 'Overdose — consider glucagon.' },
      { letter: 'B', word: 'Bug — sepsis', detail: 'Treat the underlying infection.' },
      { letter: 'B', word: 'Blocks', detail: 'Heart block — pacing.' },
      { letter: 'B', word: 'Bad — hypoxia', detail: 'Correct oxygenation.' },
      { letter: 'B', word: 'Brain — ↑ICP', detail: 'Cushing reflex.' },
      { letter: 'B', word: 'Below — hypothermia', detail: 'Active rewarming.' },
    ],
    note: 'Causes of bradycardia to rule out in resuscitation. Atropine first-line if symptomatic.',
  },
  {
    id: 'm-pneumonia-curbe',
    title: 'CURB-65',
    category: 'Respiratory',
    letters: [
      { letter: 'C', word: 'Confusion', detail: 'New-onset disorientation.' },
      { letter: 'U', word: 'Urea', detail: '> 7 mmol/L.' },
      { letter: 'R', word: 'Respiratory rate', detail: '>= 30 breaths/min.' },
      { letter: 'B', word: 'Blood pressure', detail: 'SBP < 90 or DBP <= 60 mmHg.' },
      { letter: '6', word: 'Age', detail: '>= 65 years.' },
    ],
    note: 'Severity score for community-acquired pneumonia. Score 0-1 = home care, 2 = hospital, >= 3 = consider ICU.',
  },
  {
    id: 'm-mrc-colours',
    title: 'MRC Dyspnoea',
    category: 'Respiratory',
    letters: [
      { letter: '1', word: 'Grade 1', detail: 'Breathless on strenuous exercise.' },
      { letter: '2', word: 'Grade 2', detail: 'Short of breath hurrying on level ground.' },
      { letter: '3', word: 'Grade 3', detail: 'Walks slower than peers on level ground.' },
      { letter: '4', word: 'Grade 4', detail: 'Stops after 100 m or a few minutes.' },
      { letter: '5', word: 'Grade 5', detail: 'Too breathless to leave the house.' },
    ],
    note: 'MRC dyspnoea scale for chronic respiratory disease severity.',
  },
  {
    id: 'm-dvt-wells',
    title: 'Wells DVT',
    category: 'Cardiology',
    letters: [
      { letter: '1', word: 'Active cancer', detail: '+1' },
      { letter: '1', word: 'Paralysis/paresis/recent cast', detail: '+1' },
      { letter: '1', word: 'Recently bedridden >3 days or major surgery', detail: '+1' },
      { letter: '1', word: 'Localized tenderness', detail: '+1' },
      { letter: '1', word: 'Swollen entire leg', detail: '+1' },
      { letter: '1', word: 'Calf swelling >3 cm vs other', detail: '+1' },
      { letter: '1', word: 'Pitting oedema', detail: '+1' },
      { letter: '1', word: 'Collateral superficial veins', detail: '+1' },
      { letter: '1', word: 'Previously documented DVT', detail: '+1' },
      { letter: '-2', word: 'Alternative diagnosis more likely', detail: '-2' },
    ],
    note: 'Wells score for DVT probability. <= 0 unlikely DVT (use D-dimer); >= 2 likely DVT (compression ultrasound).',
  },
  {
    id: 'm-puvs',
    title: 'PUV',
    category: 'Paediatrics',
    letters: [
      { letter: 'P', word: 'Posterior', detail: 'In males, the urethral valves sit posteriorly.' },
      { letter: 'U', word: 'Urethral', detail: 'Obstructing membrane in the urethra.' },
      { letter: 'V', word: 'Valves', detail: 'Most common cause of lower urinary tract obstruction in male newborns.' },
    ],
    note: 'Suspect in male infants with bilateral hydronephrosis, weak urinary stream, or poor weight gain.',
  },
  {
    id: 'm-bishops-score',
    title: 'Bishop\'s Score',
    category: 'Obstetrics',
    letters: [
      { letter: 'P', word: 'Position', detail: 'Cervical position (posterior/mid/anterior).' },
      { letter: 'C', word: 'Consistency', detail: 'Firm/medium/soft.' },
      { letter: 'E', word: 'Effacement', detail: '0-30%, 40-50%, 60-70%, >=80%.' },
      { letter: 'D', word: 'Dilation', detail: '0-1, 2-3, 4-5, >=6 cm.' },
      { letter: 'S', word: 'Station', detail: '-3, -2, -1/0, +1/+2.' },
    ],
    note: 'Pre-induction cervical favourability. Score >= 8 favours spontaneous labour; lower scores may need cervical ripening.',
  },
  {
    id: 'm-mentals',
    title: 'AMTS',
    category: 'Psychiatry',
    letters: [
      { letter: '1', word: 'Age', detail: 'How old are you?' },
      { letter: '2', word: 'Time', detail: 'What is the time (nearest hour)?' },
      { letter: '3', word: 'Address', detail: 'Recall a given address at end.' },
      { letter: '4', word: 'Year', detail: 'What year is it?' },
      { letter: '5', word: 'Place', detail: 'Name of this place?' },
      { letter: '6', word: 'Recognise', detail: 'Identify two people.' },
      { letter: '7', word: 'Birthday', detail: 'Date of birth.' },
      { letter: '8', word: 'Monarch', detail: 'First World War dates.' },
      { letter: '9', word: 'Count', detail: 'Count backwards from 20 to 1.' },
      { letter: '10', word: 'Recall', detail: 'Recall the address given earlier.' },
    ],
    note: 'Abbreviated Mental Test Score. Score <= 7 suggests cognitive impairment, warranting fuller assessment (e.g. MMSE, MoCA).',
  },
] as const;

export const MNEMONIC_CATEGORIES: MnemonicCategory[] = [
  'Emergency', 'Pharmacology', 'Anatomy', 'Paediatrics', 'Obstetrics', 'Cardiology', 'Psychiatry', 'Respiratory',
];
