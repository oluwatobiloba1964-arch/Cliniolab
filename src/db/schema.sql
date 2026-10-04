-- Clinio D1 Schema

CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Supabase auth user id
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- user | moderator | admin
  email_quiz_results INTEGER NOT NULL DEFAULT 1, -- per-user opt-in, defaults on
  email_newsletter INTEGER NOT NULL DEFAULT 1,   -- per-user opt-in, defaults on
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date TEXT,          -- date (YYYY-MM-DD) of last quiz/exam attempt
  creator_balance_kobo INTEGER NOT NULL DEFAULT 0, -- withdrawable earnings from paid quiz sales, platform holds funds until payout
  payout_bank_code TEXT,            -- Flutterwave bank code, needed to actually send a transfer
  payout_bank_name TEXT,
  payout_account_number TEXT,
  payout_account_name TEXT,
  contact_phone TEXT,               -- optional, shown on shared quiz text ("contact: ...")
  bio TEXT,                         -- shown on the creator's public profile page
  avatar_path TEXT,                 -- /api/images/avatars/<uuid>.<ext>, shown on public profile
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(category_id, slug)
);

CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  subcategory_id TEXT NOT NULL REFERENCES subcategories(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'quiz',       -- quiz | exam
  difficulty TEXT NOT NULL DEFAULT 'medium', -- easy | medium | hard
  visibility TEXT NOT NULL DEFAULT 'private', -- public | private
  share_slug TEXT UNIQUE,
  link_expires_at TEXT,                     -- null = no expiry (public quizzes)
  time_limit_seconds INTEGER,               -- exam mode
  shuffle_questions INTEGER NOT NULL DEFAULT 0,
  shuffle_options INTEGER NOT NULL DEFAULT 0,
  anti_cheat_enabled INTEGER NOT NULL DEFAULT 0,
  retake_policy TEXT DEFAULT 'unlimited',   -- unlimited | single | daily_limit | cooldown
  retake_limit INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',     -- draft | published | archived
  pricing TEXT NOT NULL DEFAULT 'free',     -- 'free' | 'paid'
  price_kobo INTEGER,                       -- price in kobo (NGN minor unit), null if free
  allow_flagging INTEGER NOT NULL DEFAULT 1, -- creator can disable "flag this question" on results screen
  leaderboard_enabled INTEGER NOT NULL DEFAULT 1, -- only meaningful for private quizzes; creator can hide the per-quiz leaderboard from link-holders. Ignored/moot for public quizzes, which are always governed by the global leaderboard_per_quiz admin flag.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  type TEXT NOT NULL DEFAULT 'mcq', -- mcq | true_false | fill_blank
  prompt TEXT NOT NULL,
  options TEXT,          -- JSON array for mcq/true_false
  correct_answer TEXT NOT NULL, -- option id or text answer
  explanation TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_taken_seconds INTEGER,
  counts_for_leaderboard INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  submitted_answer TEXT,
  is_correct INTEGER NOT NULL
);

-- One row per completed Study Mode session. No score/leaderboard
-- concept (Study Mode intentionally never touches quiz_attempts) -
-- every finished session is its own row. See
-- migrations/2026-09-add-study-attempts.sql for details.
CREATE TABLE study_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_study_attempts_quiz ON study_attempts(quiz_id);
CREATE INDEX idx_study_attempts_user ON study_attempts(user_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  quiz_id TEXT REFERENCES quizzes(id),
  blog_post_id TEXT REFERENCES blog_posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  parent_comment_id TEXT REFERENCES comments(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_comments_quiz_id ON comments(quiz_id);
CREATE INDEX idx_comments_blog_post_id ON comments(blog_post_id);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);

CREATE TABLE comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comment_id, user_id) -- one like per user per comment
);

CREATE TABLE question_reports (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | reviewed | dismissed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_question_reports_status_created_at ON question_reports(status, created_at);

CREATE TABLE blog_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE blog_subcategories (
  id TEXT PRIMARY KEY,
  blog_category_id TEXT NOT NULL REFERENCES blog_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(blog_category_id, slug)
);

CREATE INDEX idx_blog_subcategories_category ON blog_subcategories(blog_category_id, sort_order);

CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'markdown', -- 'markdown' | 'html' - html is sanitized on render, never trusted raw
  excerpt TEXT,                       -- short manual summary; falls back to an auto-derived excerpt of `content` when unset
  category TEXT,                      -- LEGACY free-text tag, kept only so old posts keep rendering as-is. New posts use blog_category_id/blog_subcategory_id instead.
  blog_category_id TEXT REFERENCES blog_categories(id),    -- one of the fixed top-level categories (Anatomy & Physiology, Job, Scholarship, etc.)
  blog_subcategory_id TEXT REFERENCES blog_subcategories(id), -- admin-defined, freeform within the chosen category; persists for reuse
  featured_image_url TEXT,            -- external URL or /api/images/... (R2-backed) path
  seo_title TEXT,                     -- overrides <title>/OG title if set; falls back to `title`
  seo_description TEXT,               -- overrides meta description if set; falls back to an auto-excerpt of `content`
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published
  is_sponsored INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  full_width INTEGER NOT NULL DEFAULT 0, -- admin opt-in: render post body in the wide container instead of the narrow article column
  send_as_newsletter INTEGER NOT NULL DEFAULT 0, -- if 1, emails all newsletter-subscribed users on publish
  newsletter_sent_at TEXT,            -- set once sent, prevents duplicate sends
  send_push INTEGER NOT NULL DEFAULT 0, -- if 1, sends a push notification to all subscribed users on publish
  push_sent_at TEXT,                  -- set once sent, prevents duplicate sends
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_blog_posts_category ON blog_posts(blog_category_id, status, created_at);

-- Fixed top-level blog categories. Admins pick one of these when writing a
-- post — they cannot add/remove from this list via the UI. Subcategories
-- within a category ARE freely addable by admins (see blog_subcategories).
INSERT INTO blog_categories (id, name, slug, sort_order) VALUES
('blogcat_anatomy_physiology', 'Anatomy & Physiology', 'anatomy-physiology', 1),
('blogcat_pharmacology', 'Pharmacology', 'pharmacology', 2),
('blogcat_microbiology', 'Microbiology', 'microbiology', 3),
('blogcat_pathophysiology', 'Pathophysiology', 'pathophysiology', 4),
('blogcat_biochemistry', 'Biochemistry', 'biochemistry', 5),
('blogcat_nursing', 'Nursing', 'nursing', 6),
('blogcat_general_clinical', 'General Clinical', 'general-clinical', 7),
('blogcat_clinical_specialists', 'Clinical Specialists', 'clinical-specialists', 8),
('blogcat_clinical_scenarios', 'Clinical Scenarios', 'clinical-scenarios', 9),
('blogcat_others', 'Others', 'others', 10),
('blogcat_job', 'Job', 'job', 11),
('blogcat_scholarship', 'Scholarship', 'scholarship', 12),
('blogcat_clinical_pearls', 'Clinical Pearls', 'clinical-pearls', 13),
('blogcat_exam_prep_guides', 'Exam Prep Guides', 'exam-prep-guides', 14);

CREATE TABLE static_pages (
  id TEXT PRIMARY KEY,       -- e.g. 'about', 'contact', 'terms', 'privacy', 'faq'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,       -- e.g. 'leaderboard_general', 'leaderboard_category', 'comments', 'public_quiz_creation'
  enabled INTEGER NOT NULL DEFAULT 1,
  label TEXT                  -- admin-customizable display name (e.g. leaderboard rename)
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Standalone Flashcard feature. A flashcard_set is the shareable/browsable
-- unit (like a quiz) - own title, category/subcategory, pricing, creator.
-- Shows in its own "Flashcards" homepage section/nav item AND inside each
-- category's block, labelled "Flashcard".
CREATE TABLE flashcard_sets (
  id TEXT PRIMARY KEY,
  subcategory_id TEXT NOT NULL REFERENCES subcategories(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public', -- public | private
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | published | archived
  pricing TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'paid'
  price_kobo INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_flashcard_sets_subcategory ON flashcard_sets(subcategory_id);
CREATE INDEX idx_flashcard_sets_visibility ON flashcard_sets(visibility, status);
CREATE INDEX idx_flashcard_sets_creator ON flashcard_sets(creator_id);

CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_flashcards_set ON flashcards(set_id);

-- Mirrors quiz_purchases exactly - same Flutterwave + platform-fee-split
-- model, reusing existing payment/payout infrastructure.
CREATE TABLE flashcard_purchases (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL,
  platform_fee_kobo INTEGER NOT NULL,
  creator_earning_kobo INTEGER NOT NULL,
  tx_ref TEXT UNIQUE NOT NULL,
  flw_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(set_id, buyer_id)
);

CREATE INDEX idx_flashcard_purchases_buyer ON flashcard_purchases(buyer_id);
CREATE INDEX idx_flashcard_purchases_set ON flashcard_purchases(set_id);

-- One row per completed run through a flashcard set (reached the last
-- card). Powers the "X attempts" stat on flashcard set cards, the
-- flashcard equivalent of quiz_attempts' attempt_count.
CREATE TABLE flashcard_attempts (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_flashcard_attempts_set ON flashcard_attempts(set_id);
CREATE INDEX idx_flashcard_attempts_user ON flashcard_attempts(user_id);

-- Generic key/value store for small admin-editable homepage content blocks
-- (e.g. the "latest video" YouTube embed). Distinct from feature_flags
-- because it carries content, not just an on/off boolean, and distinct
-- from static_pages because it's a small widget, not a full page.
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,     -- e.g. 'homepage_video'
  value TEXT NOT NULL,      -- JSON blob, shape depends on key
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin-managed CTA / advertising banners. `placement` controls where a
-- banner renders: 'header' is the long full-width strip under the homepage
-- hero, 'footer' is the normal-sized banner above the footer's site-links
-- grid. Multiple banners can exist per placement; `sort_order` controls
-- display order and `is_active` lets admins toggle individual banners
-- without deleting them.
CREATE TABLE banners (
  id TEXT PRIMARY KEY,
  placement TEXT NOT NULL,        -- 'header' | 'footer'
  title TEXT NOT NULL,
  image_path TEXT NOT NULL,       -- /api/images/banners/uuid.ext
  link_url TEXT,                  -- optional destination when clicked
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per view/click event on a banner. Kept as an event log rather
-- than a running counter on the banners table so events can be queried by
-- date range later (e.g. "impressions this month" for a sponsor report)
-- without losing historical detail.
CREATE TABLE banner_events (
  id TEXT PRIMARY KEY,
  banner_id TEXT NOT NULL REFERENCES banners(id),
  event_type TEXT NOT NULL,       -- 'impression' | 'click'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_banner_events_banner ON banner_events(banner_id, event_type);

-- Web push subscriptions, one row per browser/device a user has enabled
-- notifications on. endpoint is unique per browser subscription.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Resources: Google-Drive-backed books/slides AND institution-specific past
-- question packs, shown together on one page but distinguished by `kind`.
-- The real Drive link is never sent to the client for paid+unconfirmed
-- resources - only resolved server-side at download-click time.
-- Sub-categories shown under the Book / Past Question Pack tabs on the
-- resources page (e.g. "OSCE", "Pharmacology", "Nursing Council Prep").
-- Scoped by `kind`, not by a parent category row — separate tree from the
-- quiz categories/subcategories above.
CREATE TABLE resource_categories (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- 'book' | 'past_question_pack'
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kind, slug)
);

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- 'book' | 'past_question_pack'
  category_id TEXT REFERENCES resource_categories(id), -- optional sub-category, scoped to `kind`
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  institution_name TEXT,              -- e.g. 'UBTH School of Nursing' (past_question_pack only)
  subject_tag TEXT,                   -- free-text subject/category label
  pricing TEXT NOT NULL DEFAULT 'free', -- 'free' | 'paid'
  price_kobo INTEGER,                 -- price in kobo (NGN minor unit), null if free
  drive_link TEXT NOT NULL,           -- never exposed directly to the client
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'published', -- draft | published | archived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_resources_category ON resources(category_id);

-- One row per user's purchase attempt/entitlement for a paid resource.
-- Serves BOTH payment modes (site setting: resource_payment_mode):
--   'manual': proof_image_url + status starts 'pending', admin confirms/rejects.
--   'flutterwave': tx_ref/flw_transaction_id used, status auto-set to
--   'confirmed' the moment verifyTransaction succeeds - no admin step.
CREATE TABLE resource_purchases (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  proof_image_url TEXT,               -- receipt/screenshot the user submits (manual mode)
  tx_ref TEXT,                        -- our reference sent to Flutterwave (flutterwave mode)
  flw_transaction_id TEXT,            -- Flutterwave's transaction id (flutterwave mode)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected
  confirmed_by TEXT REFERENCES users(id), -- admin who confirmed (manual mode only; null for auto-confirmed)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  UNIQUE(resource_id, user_id)
);

-- User-submitted feedback / bug reports.
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id), -- nullable: allow anonymous feedback
  category TEXT NOT NULL DEFAULT 'general', -- 'bug' | 'suggestion' | 'general'
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | reviewed | resolved
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of sent emails, mainly to avoid accidental duplicate sends for
-- one-time emails (welcome, leaderboard recognition batches) and to give
-- admin visibility into what's gone out.
CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  email_type TEXT NOT NULL, -- 'welcome' | 'leaderboard_recognition' | 'newsletter' | 'quiz_result' | 'comment_reply' | 'inactivity_nudge' | 'password_reset'
  reference_id TEXT,        -- e.g. blog_post id for newsletter, quiz_id for quiz_result
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per successful purchase of a paid quiz. The actual money split
-- happens at Paystack (creator subaccount gets their %, platform account
-- gets the rest) - this table just records the purchase for access
-- control (has this user paid for this quiz?) and for the creator's
-- earnings ledger view.
CREATE TABLE quiz_purchases (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL,          -- total amount paid
  platform_fee_kobo INTEGER NOT NULL,    -- platform's cut of amount_kobo
  creator_earning_kobo INTEGER NOT NULL, -- creator's cut of amount_kobo, credited to creator_balance_kobo on completion
  tx_ref TEXT UNIQUE NOT NULL,           -- our own reference, sent as tx_ref to Flutterwave
  flw_transaction_id TEXT,               -- Flutterwave's transaction id, returned on redirect, used to verify
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(quiz_id, buyer_id)
);

-- One row per creator payout request. Admin always reviews the request;
-- the "method" only changes HOW it's fulfilled (a real Flutterwave
-- transfer vs. admin paying manually outside the system and marking it done).
CREATE TABLE payout_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL,
  method TEXT,                       -- 'flutterwave' | 'manual', set when admin actions the request
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paid | failed
  flw_transfer_id TEXT,              -- set if method = 'flutterwave'
  admin_note TEXT,                   -- e.g. manual transfer reference, or failure reason
  actioned_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  actioned_at TEXT
);

CREATE INDEX idx_payout_requests_creator ON payout_requests(creator_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);

CREATE INDEX idx_quiz_purchases_buyer ON quiz_purchases(buyer_id);
CREATE INDEX idx_quiz_purchases_quiz ON quiz_purchases(quiz_id);

CREATE INDEX idx_quizzes_subcategory ON quizzes(subcategory_id);
CREATE INDEX idx_quizzes_visibility ON quizzes(visibility, status);
CREATE INDEX idx_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_comments_quiz ON comments(quiz_id);
CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_resources_kind ON resources(kind, status);
CREATE INDEX idx_resource_purchases_user ON resource_purchases(user_id);
CREATE INDEX idx_resource_purchases_resource ON resource_purchases(resource_id);
CREATE INDEX idx_blog_pinned ON blog_posts(is_pinned, created_at);

-- One row per user-saved quiz or resource. A single table with a `kind`
-- column rather than two separate tables, since both bookmark types share
-- the exact same shape (user, target id, timestamp) and are usually
-- listed together on one "My bookmarks" page.
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                 -- 'quiz' | 'resource'
  target_id TEXT NOT NULL,            -- quizzes.id or resources.id depending on kind
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, kind, target_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id, kind);

-- Admin/moderator-managed clinical term glossary. Deliberately NOT
-- auto-generated (no reliable free source for Nigerian/global clinical
-- abbreviations, and a wrong entry is a real risk in a clinical-education
-- tool) - staff enter these manually, same trust model as everything else.
CREATE TABLE medical_abbreviations (
  id TEXT PRIMARY KEY,
  abbreviation TEXT NOT NULL,         -- e.g. "NPO", or the full term when is_glossary = 1, e.g. "Homeostasis"
  meaning TEXT NOT NULL,              -- e.g. "Nil per os (nothing by mouth)"
  category TEXT,                      -- optional grouping, e.g. "Vital Signs", "Medication Orders"
  is_glossary INTEGER NOT NULL DEFAULT 0, -- 0 = short abbreviation, 1 = full glossary term
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_abbreviations_term ON medical_abbreviations(abbreviation);
CREATE INDEX idx_abbreviations_is_glossary ON medical_abbreviations(is_glossary);

-- Homepage-featured spotlight. Admin/moderator can feature ANY person,
-- not necessarily tied to a platform user account (student_user_id is
-- optional) - covers cases like featuring someone who isn't even a
-- Cliniolab user, per product requirements.
CREATE TABLE scholars_of_the_day (
  id TEXT PRIMARY KEY,
  student_user_id TEXT REFERENCES users(id), -- optional link to a real account, if the featured person has one
  name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  achievement TEXT,                   -- short highlight line, e.g. "Top scorer in Cardiology this month"
  quote TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, -- only one should be active at a time; homepage shows the most recent active one
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scholars_active ON scholars_of_the_day(is_active, created_at);
