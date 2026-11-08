# Cliniolab fixes — November 2026

This package contains only the new and modified files for the fixes
described below. Drop them onto your existing Cliniolab checkout
preserving the directory structure, then run `npm install` to pick up
the new `web-push` dependency.

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx next build` → ✓ Compiled successfully (88 static pages, `/mnemonics` route confirmed)
- Zero new API routes
- Zero new database migrations
- Zero required new env vars
- One optional new dependency: `web-push@^3.6.7` (with `@types/web-push@^3.6.4`)

## Audit fixes applied

### G — Image optimisation + alt text
Replaced every `alt=""` with a meaningful description, added
`loading="lazy"` and `decoding="async"` to every `<img>` and
markdown-emitted image, and added a new `OptimizedImage` wrapper
component that enforces non-empty alt text and lazy loading by
default. Centralised next/image hints (`formats`, `dangerouslyAllowSVG`)
in `next.config.mjs`.

Files touched:
- `src/components/resources/ResourceCard.tsx`
- `src/components/cms/BlogPostCard.tsx` (3 img tags)
- `src/components/ui/ImageLibraryModal.tsx`
- `src/components/ui/InlineImageManager.tsx`
- `src/components/ui/ImagePicker.tsx`
- `src/components/ui/RichTextEditor.tsx`
- `src/components/creator/CreatorProfileCard.tsx`
- `src/app/admin/scholars/page.tsx`
- `src/app/blog/[slug]/BlogPostClient.tsx`
- `src/app/creator/[userId]/CreatorProfileClient.tsx`
- `src/app/dashboard/creator-settings/page.tsx`
- `src/components/layout/ScholarOfTheDayCard.tsx`
- `src/components/layout/NavBar.tsx`
- `src/components/ui/OptimizedImage.tsx` (new)
- `next.config.mjs`

### H — Web Push: vetted-package-first with verbatim fallback
Rewrote `src/lib/push/webPush.ts` so the primary send path uses the
audited `web-push` npm package via dynamic `import()`. If the package
is not installed or throws, the original hand-rolled RFC-8291 + VAPID
implementation runs verbatim as a fallback (same wire output). The
fallback path uses only Web Crypto, so it works in both Node.js and
Cloudflare Workers runtime without `node:crypto` polyfills. The
package is added to `package.json` so `npm install` makes it
available; if the package fails to load (e.g. Workers runtime
incompatibility), the fallback keeps push working without any user
visible change.

Files touched:
- `src/lib/push/webPush.ts` (rewritten)
- `package.json` (added `web-push` + `@types/web-push`)

### K — Mobile navigation
Removed the horizontal-scrolling pill row that hid the active state
on mobile. Replaced it with a PWA-style bottom navigation bar
showing the four most important destinations: Home, Quizzes,
Dashboard, Search. The bar respects `env(safe-area-inset-bottom)`
for newer devices with home indicators, and lifts the page body
above itself so the last card is never hidden. Active item uses
`aria-current="page"`.

Files touched:
- `src/components/layout/NavBar.tsx`
- `src/styles/globals.css` (mobile bottom-nav CSS + reduce-motion utility + focus-visible ring)

### M — Accessibility
- Every `<img>` now has a meaningful `alt` (see fix G).
- All icon-only buttons carry `aria-label` and `aria-hidden="true"` on
  the icon.
- Desktop nav links use `aria-current="page"` when active.
- Mobile bottom nav uses `aria-current="page"` and `aria-pressed`
  on the search toggle.
- Quiz filter buttons use `aria-pressed` and the filter group has
  `role="group"` + `aria-label`.
- Timer has an `aria-label` that announces the remaining time
  and percentage so the visual ring can be hidden on small screens
  without losing information.
- `:focus-visible` ring added globally (teal, 2px) for keyboard users
  only — does not show on mouse click.
- Reduce-motion utility class `.cliniolab-reduce-motion` for
  future preference toggles.

## UI / UX improvements

### Error recovery (`src/app/error.tsx`)
The error boundary now classifies the error message and shows a
specific recovery action:
- Payment errors → "Go to dashboard"
- Network errors → "Try again" (reload)
- 404 / "not found" → "Browse quizzes"
- Default → "Try again"

### Empty states (`src/app/quizzes/QuizzesClient.tsx`)
The quiz listing now distinguishes two cases when no quizzes are
visible:
- Filters active → "No quizzes match these filters. Clear filters."
- No filters active → "No quizzes published yet. Create the first
  quiz." (with a CTA to `/quizzes/new`).

### Content-shaped skeletons
- `src/app/blog/loading.tsx` — mirrors the blog listing layout
  (header, featured post, 6-card grid).
- `src/app/quizzes/loading.tsx` — mirrors the quiz listing layout
  (header, filter row, 6-card grid).
- `src/app/mnemonics/loading.tsx` — mirrors the mnemonics page.

All skeletons use `animate-pulse` for a subtle shimmer and include
`aria-hidden="true"` on decorative placeholders plus an `sr-only`
"Loading…" message for screen readers.

### Recent searches (`src/components/search/SearchAutocomplete.tsx`)
Adds a "Recent searches" section above the API suggestions, capped
at 8 entries (key: `cliniolab_recent_searches_v1`). Tapping a recent
search runs the search immediately. Includes a "Clear" button. Falls
back gracefully — if localStorage is unavailable, recent searches
simply don't appear.

## Responsive fixes

### QuizRunner timer ring (`src/components/quiz/QuizRunner.tsx`)
The timer ring (12×12 visual circle) is hidden on screens narrower
than 380px to give the time display room to breathe on small phones.
The percentage is preserved in an `aria-label` so screen readers
still announce it.

### QuizRunner filter row
The progress filter row (All / Unanswered / Answered / Skipped /
Marked) now scrolls horizontally on mobile via
`overflow-x-auto overscroll-x-contain`, with `shrink-0` on each
button so they don't compress. Each button also has `aria-pressed`
to indicate the active state.

### ScholarOfTheDayCard
Card now reflows on small screens: smaller padding (`p-5 sm:p-8`),
smaller avatar (`h-20 w-20 sm:h-24 sm:w-24`), smaller heading
(`text-lg sm:text-xl`), tighter line-height on long-form text.
Container uses `px-4 py-10 sm:px-6 sm:py-16` instead of fixed
`px-6 py-16`.

## Database-independent features

All five features below are pure client-side: no `fetch`, no API
route, no D1 read, no Supabase call. They use only `localStorage`
and data the page already fetched for other purposes. They render
nothing on a fresh device (no data = no card), so they never
clutter the first-run experience.

### F1 — Daily Clinical Challenge
- `src/lib/services/dailyChallengeService.ts` — 12-question curated
  bank of clinical scenarios (Cardiology, Respiratory, Pharmacology,
  Paediatrics, Neurology, Endocrinology, Renal, GI, ID, Obstetrics,
  Psychiatry, Trauma). Deterministic day-of-year selection so every
  visitor on the same day sees the same set. Streak counter rewards
  daily return (`cliniolab_daily_challenge_streak_v1`).
- `src/components/home/DailyChallenge.tsx` — homepage widget with
  intro / questions / results phases. Shows the streak, lets the
  learner pick answers, scores them on submit, and shows
  explanations for each question. Marking today as played updates
  the streak once per day.
- Wired into `src/app/HomeClient.tsx` between InstantDemoQuiz and
  HomeLatestArticle.

### F2 — Weak Spot Trainer
- `src/lib/services/weakSpotTrainerService.ts` — aggregates the
  existing miss-reason data (already saved by QuizRunner via
  `localInsightsService`) into prioritised topic buckets. Picks the
  dominant miss reason per topic and generates a recommendation
  with a deep link to `/search?q=<topic>`.
- `src/components/dashboard/WeakSpotTrainerCard.tsx` — dashboard
  card showing the top weak spot, total miss count, and up to 2
  secondary weak spots with severity badges.
- Wired into `src/app/dashboard/page.tsx` in the "Study tools and
  revision" section, between TodayPlanCard and LocalStudyToolkit.

### F4 — Smart Revision Badge
- `src/components/layout/SmartRevisionBadge.tsx` — small amber
  badge that shows the count of currently-due missed-question SRS
  reviews. Refreshes every 60s and on `window:focus`. Renders
  nothing when the count is zero.
- Wired into `src/components/layout/NavBar.tsx` on the Quizzes
  bottom-nav item so the count is visible from any page on mobile.

### F5 — Missed-Question SRS
- `src/lib/services/missedQuestionSrsService.ts` — SM-2-inspired
  spaced repetition deck for missed quiz questions. Stores one
  item per `quizId:questionId` with repetitions, ease factor,
  interval, last-reviewed, due-at. Four ratings: Again (10 min),
  Hard (1 day), Good (3 days), Easy (7 days). Idempotent add —
  re-adding a question refreshes its title/prompt but preserves
  the existing schedule and miss reason. Includes a one-time
  `reseedFromMissReasons()` that backfills the deck from the
  existing miss-reason log so learners with history see their
  due cards immediately.
- `src/components/dashboard/MissedQuestionSrsCard.tsx` — dashboard
  card that walks through due cards one at a time. Shows the
  prompt, a "Show answer & rate" button, then the four rating
  buttons each with a friendly next-interval preview
  ("in 10 min", "in 3 days", etc.). Includes a "Remove from deck"
  action for cards the learner no longer wants to review.
- `src/components/quiz/QuizRunner.tsx` — added a hook in the
  existing insights-saving effect that calls `addMissedQuestion`
  for each incorrect question (default reason: `knowledge-gap`,
  since QuizRunner doesn't know the per-question reason; learners
  can refine via MissReasonJournal later, and the SRS deck
  preserves the manually-tagged reason over the default).
- Wired into `src/app/dashboard/page.tsx` after WeakSpotTrainerCard.

### F11 — Mnemonics library
- `src/lib/data/mnemonics.ts` — 19 hand-curated mnemonics covering
  MONA, FAST, MUDPILES, APGAR, ABCDE, RIDE, SLUDGE, SAMPLE, PQRST,
  DRIP, ABC of Burns, MMF, "Six B's of Bradycardia", CURB-65, MRC
  Dyspnoea, Wells DVT, PUV, Bishop's Score, AMTS. Each has a
  category, letters-with-details, and a clinical note.
- `src/lib/services/mnemonicsStarService.ts` — star toggle that
  stores starred mnemonic ids in `cliniolab_mnemonics_starred_v1`.
- `src/app/mnemonics/page.tsx` — server component (metadata only).
- `src/app/mnemonics/MnemonicsClient.tsx` — interactive list with
  category filter chips, "Starred only" toggle, and per-card star
  button. Hydration-safe: mounts then reads starred state from
  localStorage.
- `src/app/mnemonics/loading.tsx` — content-shaped skeleton.
- `src/app/sitemap.ts` — added `/mnemonics` route (priority 0.6,
  monthly change frequency).

## localStorage keys added

| Key | Purpose |
| --- | --- |
| `cliniolab_daily_challenge_streak_v1` | F1: streak state, last-played day, history |
| `cliniolab_missed_question_srs_v1` | F5: SRS deck items |
| `cliniolab_mnemonics_starred_v1` | F11: starred mnemonic ids |
| `cliniolab_recent_searches_v1` | UI: recent search queries (max 8) |

All keys use the existing `cliniolab_*` prefix convention and the
project's existing `readJson` / `writeJson` safe-parse helpers where
applicable. All writes are wrapped in try/catch so a full localStorage
quota never breaks the UI.

## Installation

1. Drop these files onto your existing checkout, preserving paths.
2. Run `npm install` to pick up `web-push@^3.6.7` and
   `@types/web-push@^3.6.4`.
3. Run `npx tsc --noEmit` to confirm (should be 0 errors).
4. Run `npx next build` to confirm the production build.
5. Deploy as usual. The new `/mnemonics` route will appear; the new
   localStorage keys will populate as users interact with the
   daily challenge, weak-spot trainer, SRS deck, and mnemonics
   library.

No database migration is required. No new env vars are required.
No new API routes were added.
