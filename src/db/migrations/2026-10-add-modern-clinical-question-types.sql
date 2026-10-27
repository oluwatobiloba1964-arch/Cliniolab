-- Migration: 2026-10-add-modern-clinical-question-types.sql
-- Cliniolab Next-Generation Clinical Question Types
--
-- This migration documents and verifies support for modern clinical examination question formats:
-- 1. 'sata'      - Select All That Apply (multi-select with NCLEX-style +/- scoring)
-- 2. 'ordering'  - Clinical Sequence / Prioritization (drag & drop step ordering)
-- 3. 'matrix'    - Clinical Decision Matrix (Indicated / Contraindicated / Not Related)
-- 4. 'highlight' - Clinical Red Flag Cues (clicking EHR findings to highlight abnormal cues)
--
-- Note on Cloudflare D1 / SQLite Compatibility:
-- The `questions` table schema defines:
--   type TEXT NOT NULL DEFAULT 'mcq'
-- Because `type` is a TEXT column without an inline CHECK constraint, D1 accepts the new
-- question types immediately. No table rebuild or ALTER TABLE is required.
-- Existing quizzes and attempts continue to function with zero downtime.

-- Validation check to verify existing question distribution
SELECT type, COUNT(*) AS question_count
FROM questions
GROUP BY type;

-- Optional test seed examples illustrating the 4 question types:

-- Example 1: SATA (Select All That Apply)
-- options: JSON array of choices
-- correct_answer: JSON array of correct option IDs
-- INSERT INTO questions (
--   id, quiz_id, type, prompt, options, correct_answer, explanation, sort_order, mark
-- ) VALUES (
--   'q_sata_example',
--   'quiz_clinical_sample',
--   'sata',
--   'A patient is admitted with suspected acute pulmonary embolism. Which provider orders should the nurse anticipate? Select all that apply.',
--   '[{"id":"s1","text":"Administer oxygen to maintain SpO2 > 94%"},{"id":"s2","text":"Place patient in Trendelenburg position"},{"id":"s3","text":"Initiate continuous IV unfractionated heparin infusion"},{"id":"s4","text":"Obtain 12-lead ECG and serum troponin levels"},{"id":"s5","text":"Administer oral aspirin 325 mg immediately"}]',
--   '["s1","s3","s4"]',
--   'Oxygen, IV heparin anticoagulation, and cardiac diagnostic evaluation (ECG/troponin) are indicated. Trendelenburg position and unconfirmed oral antiplatelets are contraindicated.',
--   1,
--   2
-- );

-- Example 2: Clinical Ordering (Drag & Drop Sequence)
-- options: JSON array of procedural steps
-- correct_answer: JSON array of step IDs in priority order
-- INSERT INTO questions (
--   id, quiz_id, type, prompt, options, correct_answer, explanation, sort_order, mark
-- ) VALUES (
--   'q_order_example',
--   'quiz_clinical_sample',
--   'ordering',
--   'The nurse is preparing to administer a packed red blood cell (PRBC) transfusion. Sequence the clinical nursing actions in priority order from first to last.',
--   '[{"id":"o1","text":"Verify physician order and signed informed consent in medical record"},{"id":"o2","text":"Confirm recipient identity and blood unit with a second qualified healthcare provider at bedside"},{"id":"o3","text":"Obtain baseline pre-transfusion vital signs"},{"id":"o4","text":"Prime blood administration set tubing with 0.9% normal saline only"},{"id":"o5","text":"Initiate transfusion at slow rate (2 mL/min) and monitor client closely for first 15 minutes"}]',
--   '["o1","o3","o4","o2","o5"]',
--   'Proper clinical sequence: 1) Verify consent/order, 2) Obtain baseline vitals, 3) Prime blood tubing with 0.9% NS, 4) Dual-provider bedside verification, 5) Initiate slowly with continuous observation.',
--   2,
--   2
-- );

-- Example 3: Clinical Decision Matrix
-- options: JSON array of clinical actions / rows
-- correct_answer: JSON object mapping each row ID to indicated, contraindicated, or not_related
-- INSERT INTO questions (
--   id, quiz_id, type, prompt, options, correct_answer, explanation, sort_order, mark
-- ) VALUES (
--   'q_matrix_example',
--   'quiz_clinical_sample',
--   'matrix',
--   'A client at 34 weeks gestation presents with a blood pressure of 168/104 mmHg, 3+ proteinuria, and a frontal headache. For each nursing intervention, specify whether it is Indicated, Contraindicated, or Not Related.',
--   '[{"id":"m1","text":"Administer IV Magnesium Sulfate per facility pre-eclampsia protocol"},{"id":"m2","text":"Encourage ambulation in the hallway to lower anxiety"},{"id":"m3","text":"Maintain dark, quiet environment and implement seizure precautions"},{"id":"m4","text":"Administer sublingual Nifedipine without physician order"},{"id":"m5","text":"Check deep tendon reflexes (DTRs) and clonus hourly"}]',
--   '{"m1":"indicated","m2":"contraindicated","m3":"indicated","m4":"contraindicated","m5":"indicated"}',
--   'In severe pre-eclampsia, Magnesium Sulfate, quiet environment, seizure precautions, and frequent DTR monitoring are Indicated. Ambulation and unprescribed medications are Contraindicated.',
--   3,
--   2
-- );

-- Example 4: Highlighting Clinical Red Flags
-- options: JSON array of clinical findings from the observation note
-- correct_answer: JSON array of abnormal cue IDs that should be highlighted
-- INSERT INTO questions (
--   id, quiz_id, type, prompt, options, correct_answer, explanation, sort_order, mark
-- ) VALUES (
--   'q_highlight_example',
--   'quiz_clinical_sample',
--   'highlight',
--   'Review the Emergency Department Nursing Triage Note below. Click directly on findings to highlight the clinical red flags that require immediate provider escalation.',
--   '[{"id":"c1","text":"Temperature 39.3 C (102.7 F)"},{"id":"c2","text":"Blood pressure 82/46 mmHg"},{"id":"c3","text":"Heart rate 132 bpm"},{"id":"c4","text":"Pupils equal, round and reactive to light"},{"id":"c5","text":"Lethargic, responds only to painful stimuli"},{"id":"c6","text":"Skin dry with warm extremities"}]',
--   '["c1","c2","c3","c5"]',
--   'Hyperthermia (39.3 C), marked hypotension (82/46 mmHg), tachycardia (132 bpm), and altered mental status (lethargic) are red flag findings indicating septic shock.',
--   4,
--   2
-- );
