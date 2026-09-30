-- Guest Practice, Contributors (author trust), "why other options are wrong"
-- rationale, and new feature flags.
--
-- Apply with:
--   npx wrangler d1 execute cliniolab --remote --file=src/db/migrations/2026-10-add-guest-practice-contributors-rationale.sql
--
-- Run once. ALTER TABLE ADD COLUMN and CREATE TABLE are not idempotent on
-- purpose (matches the other migrations), so a double-apply fails loudly.

-- 1. Guest Practice ----------------------------------------------------
-- 'guest' is a third value for quizzes.visibility and
-- flashcard_sets.visibility (public | private | guest). Guest items are
-- free, open to visitors without an account, and store NOTHING per user.
-- The only guest write is an anonymous +1 on these counters when a guest
-- finishes an item.
ALTER TABLE quizzes ADD COLUMN guest_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN guest_study_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flashcard_sets ADD COLUMN guest_attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_quizzes_guest ON quizzes(visibility, status);

-- 2. Rationale: why the other options are wrong ------------------------
ALTER TABLE questions ADD COLUMN incorrect_rationale TEXT;

-- 3. Contributors (outside authors / reviewers, no login account) -------
CREATE TABLE contributors (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  credentials TEXT,          -- e.g. "RN, BNSc, MSc"
  title TEXT,                -- e.g. "Clinical Nurse Educator"
  bio TEXT,
  photo_url TEXT,            -- /api/images/... (R2) or external URL
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Per-post byline + reviewer -----------------------------------------
-- Copied from a contributor when one is picked, but freely editable per
-- post, so an editor can change the displayed name/credentials any time.
ALTER TABLE blog_posts ADD COLUMN author_name TEXT;
ALTER TABLE blog_posts ADD COLUMN author_credentials TEXT;
ALTER TABLE blog_posts ADD COLUMN author_photo_url TEXT;
ALTER TABLE blog_posts ADD COLUMN author_contributor_id TEXT;
ALTER TABLE blog_posts ADD COLUMN reviewer_name TEXT;
ALTER TABLE blog_posts ADD COLUMN reviewer_credentials TEXT;
ALTER TABLE blog_posts ADD COLUMN reviewer_photo_url TEXT;
ALTER TABLE blog_posts ADD COLUMN reviewer_contributor_id TEXT;

-- 5. Feature flags -------------------------------------------------------
INSERT OR IGNORE INTO feature_flags (key, enabled, label) VALUES
('guest_practice', 1, 'Guest Practice'),
('dark_mode', 1, 'Dark Mode Toggle'),
('offline_mode', 1, 'Offline Downloads'),
('author_box', 1, 'Author and Reviewer Box'),
('flashcard_learn_mode', 1, 'Flashcards: Learn Mode'),
('flashcard_match_mode', 1, 'Flashcards: Match Mode'),
('flashcard_test_mode', 1, 'Flashcards: Test Mode');

-- 6. Trust pages (editable in Admin > Pages) -----------------------------
INSERT OR IGNORE INTO static_pages (id, title, content) VALUES
('editorial-policy', 'Editorial Policy',
'Cliniolab publishes educational content for nursing and clinical students. Every article and question is written by a named contributor with the credentials shown on the page.

How we write: content is based on current nursing and clinical references, local Nigerian practice guidance where relevant, and recognised textbooks. We do not publish anonymous clinical advice.

How we review: clinical articles are checked by a second qualified contributor before publication where a reviewer is shown. Reviewers are credited by name and credentials.

Corrections: if you find an error, use the flag button on a question or contact us. We correct confirmed errors quickly and update the page.

Independence: sponsored content is always labelled. Sponsors never decide clinical content.

Educational use only: Cliniolab content supports study and exam preparation. It is not medical advice and does not replace professional judgement or local protocols.'),
('medical-review-policy', 'Medical Review Policy',
'Clinical and medical articles on Cliniolab are reviewed before or soon after publication by a qualified clinician or educator whose name and credentials are shown in the "Reviewed by" line.

What reviewers check: factual accuracy, current practice, safe wording of doses and procedures, and clarity for students.

Update cycle: articles are re-checked when guidance changes or when a reader reports an issue.

Limits: review does not make an article a substitute for hospital protocols, prescriber decisions or professional advice. Always follow your institution''s policies.

To report a concern about clinical accuracy, contact us with the page link and the section in question.');
