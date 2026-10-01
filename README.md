# Cliniolab

Nursing and clinical exam practice platform — quizzes, timed exams, categories,
leaderboards, comments, and an admin control panel.

**Stack:** Next.js 16 (React 19) · Cloudflare D1 (database) · Supabase (auth + realtime)
· Cloudflare Pages (hosting)

## Architecture

All database access goes through a service layer in `src/lib/db/services/*`,
exposed via the single barrel import `@/lib/db`. Components and API routes
never touch D1 directly — only `src/lib/db/client.ts` does. Same pattern for
auth: only `src/lib/auth/supabaseClient.ts` (browser) and
`src/lib/auth/supabaseServerClient.ts` (server) construct Supabase clients;
everything else imports from `src/lib/auth/authService.ts`,
`src/lib/auth/currentUser.ts`, or `src/lib/auth/permissions.ts`.

This keeps both providers swappable and stops direct client calls from
spreading across the codebase.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Supabase project
1. Create a project at https://supabase.com
2. Go to Project Settings → API and copy the Project URL and anon key
3. Go to Authentication → Providers and enable Email auth
4. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

### 3. Create a Cloudflare D1 database
```bash
npx wrangler login
npx wrangler d1 create cliniolab
```
Copy the `database_id` from the output into `wrangler.toml`.

### 3b. Create the R2 bucket (images)
```bash
npx wrangler r2 bucket create cliniolab-images
```

### 3c. Resend, Flutterwave, and cron setup
- Sign up at resend.com, verify your sending domain, get an API key →
  `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`
- Sign up at flutterwave.com and create a separate business under your
  account for Cliniolab (same company name is fine — Flutterwave supports
  multiple businesses per account, each with its own KYC) → get your
  secret key → `FLUTTERWAVE_SECRET_KEY`
- Generate push notification keys: `npx web-push generate-vapid-keys` →
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Set `CRON_SECRET` to any random string, then point an external
  scheduler (cron-job.org, GitHub Actions cron, etc.) at
  `POST /api/cron/inactivity-nudge` with header `x-cron-secret: <value>`,
  daily.

### 4. Run migrations and seed data
```bash
npm run db:migrate:local
npm run db:seed:local
```
This creates all tables and seeds categories, subcategories (including
Clinical Exams under Exam Prep), feature flags, the homepage video block,
and default static page content.

When you're ready to deploy:
```bash
npm run db:migrate:remote
npm run db:seed:remote
```

### 5. First admin user
There's no bootstrap UI for the first admin (by design — role changes
require an existing admin). After signing up your first account normally
through `/register`, promote it manually:
```bash
npx wrangler d1 execute cliniolab --remote --command \
  "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```

### 6. Local development
```bash
npm run dev
```
Note: local dev via `next dev` does not have a live D1 binding unless you
run through the Cloudflare Pages dev server instead:
```bash
npm run pages:build
npm run pages:dev
```

### 7. Deploy
```bash
npm run pages:deploy
```
Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`NEXT_PUBLIC_BASE_URL` as environment variables in the Cloudflare Pages
dashboard for the deployed project.

## Feature flags

Admin-toggleable, editable at `/admin/flags`:
- `leaderboard_general` — site-wide top 10
- `leaderboard_category` — per-category top 10
- `comments` — quiz comment threads
- `public_quiz_creation` — whether users can publish public quizzes
- `certificates` — certificate issuance on passing exams
- `homepage_video` — the YouTube embed block near the footer, editable at
  `/admin/homepage-video`
- `resources` — the Books & Past Question Packs page and homepage section
- `joblify_links` — the Scholarships & Jobs cross-link block

## Roles

- `user` — can create and attempt quizzes, comment, has a dashboard; can
  permanently delete their own quizzes and comments at any time
- `moderator` — additionally can manage blog posts and learning content,
  upload resources (books/past question packs), manage JoblifyHQ links,
  and delete **any** user's quiz or comment (not just their own)
- `admin` — full control: feature flags, all quizzes, categories, users,
  site pages, homepage video, and is the only role that can confirm/reject
  resource payment proofs

## Quiz visibility

- **Public** — appears in Latest Quizzes with the creator's name shown, no
  expiry, has a Share button (Web Share API with clipboard fallback)
- **Private** — accessible only via `/quizzes/shared/[slug]`, with an
  expiry of 1 day / 3 days / 7 days / custom. The creator can regenerate
  the link (invalidating the old one), or flip it to public at any time
  from their dashboard — once public, it appears in Latest Quizzes with
  their name attached like any other public quiz.

All quiz/exam attempts require login regardless of visibility. There is no
limit on how many quizzes or exams a user can create.

## Retakes and unlimited-attempt scoring

When anti-cheat is off (unlimited retakes allowed):
- Only the **first attempt** is written to the database.
- That first attempt is what counts toward the leaderboard and the
  dashboard's attempt history/score chart.
- Every attempt after that is graded and shown to the user on screen, but
  nothing is persisted for it — this keeps `quiz_attempts` from growing
  unbounded on popular quizzes with no retake limit.

When anti-cheat is on, the configured retake policy (single attempt /
daily limit / cooldown) is enforced, and every allowed attempt is recorded.

## Shuffle

Quiz creators can enable "Shuffle question order" and "Shuffle answer
options" per quiz (shown for exam/CBT mode in the creation form).
Shuffling happens client-side once per attempt; correct-answer grading is
unaffected since option IDs are preserved.

Exam Mode is Cliniolab's CBT (computer-based test) simulation — timed,
auto-submits when time runs out. Marketing copy uses "CBT" alongside
"Exam Mode" since that's the term students commonly search for.

## Books & Past Question Packs (`/resources`)

Google-Drive-backed downloads, combined with institution-specific past
question packs on one page, filterable by kind.

- **Admin or moderator** uploads a resource: title, description, cover
  image URL, kind (`book` or `past_question_pack`), institution name (for
  past question packs, e.g. "UBTH School of Nursing"), subject tag,
  pricing (free/paid), price in Naira, and the real Google Drive link.
- The Drive link is **never sent to the browser** except at the moment of
  an entitled download click (`/api/resources/[id]/download`, which
  re-checks entitlement server-side and redirects).
- **Free resources**: any logged-in user sees "Click to download"
  immediately.
- **Paid resources**: price is hidden until the user clicks — clicking
  reveals the price and switches the button to "Pay to unlock". The user
  pays via bank transfer outside the platform, then submits a proof of
  payment (a pasted link to a receipt/screenshot).
- **Only admin** (not moderator) can confirm or reject a submitted
  payment, from Admin → Books & Past Questions → Pending payments. Once
  confirmed, that user's button becomes "Click to download".

## Jobs & Scholarships (JoblifyHQ cross-links)

Admin/moderator can add entries with just a **title and external URL**,
split into two sections (Scholarships, Jobs). Clicking redirects to
JoblifyHQ. Shown on the homepage (4 per section) and manageable at
`/admin/joblify`.

## Blog: categories, sponsored, and pinned posts

Posts can carry a free-text `category` tag (e.g. "Clinical Scenario",
"Study Tips", "Exam Prep Guide") and two admin-only flags:
- `isSponsored` — shows a "Sponsored" label
- `isPinned` — stays at the top of the blog listing and homepage section

## Homepage layout

In order: Hero → Blog (10 latest, 2-column) → Latest Quizzes (10, "See
more" → `/quizzes`) → Leaderboard → Books & Past Questions (5, 2-column,
"See more" → `/resources`) → Jobs & Scholarships (4 per section) →
Homepage Video → Footer.

## Images (R2)

Blog featured images and resource cover images can be set either way:
- **Paste a URL** — any external image link
- **Upload** — stored in Cloudflare R2, served back via `/api/images/[key]`
  (never a raw R2 URL, so caching/headers stay centrally controlled)

Create the R2 bucket and set the binding in `wrangler.toml` (already
scaffolded as `IMAGES` → `cliniolab-images`):
```bash
npx wrangler r2 bucket create cliniolab-images
```

Resource cover images fall back to a default Cliniolab-branded cover
(`/resource-fallback-book.png` or `/resource-fallback-past-questions.png`)
when the admin doesn't set one.

## Blog editor

`/admin/blog` uses a dependency-free Markdown rich editor
(`RichTextEditor`) — toolbar buttons for bold, italic, headings, quotes,
lists, links, and images, plus a live preview toggle. Output is stored as
Markdown and rendered via a small built-in Markdown-to-HTML converter
(`markdownToHtml`), not a full CommonMark implementation but covering
everything the toolbar produces. Blog posts also support a Share button
(native share sheet + WhatsApp) on the post page.

## SEO: dynamic sitemap and per-page metadata

The sitemap (`src/app/sitemap.ts`) includes individual quiz pages, blog
posts, category and subcategory pages — not just static routes. This
matters because most organic search traffic on a quiz platform comes from
people searching a specific topic and landing on one quiz or article, not
the homepage; a sitemap listing only static routes means Google can't
efficiently discover those pages.

Rules the sitemap follows:
- **Free public quizzes only** are listed — private quizzes have no
  stable URL worth indexing (their share link rotates and expires), and
  paid quizzes' actual content sits behind a purchase gate.
- Each dynamic section (categories, quizzes, posts) fails independently
  and soft — if one D1 query has an issue, the sitemap still returns
  everything else rather than erroring out entirely.

Quiz detail (`/quizzes/[quizId]`) and blog post (`/blog/[slug]`) pages
were split into a server component (`page.tsx`, handles
`generateMetadata`) and a client component (`QuizDetailClient.tsx` /
`BlogPostClient.tsx`, handles the interactive UI). This is what gives
each quiz and each post its own `<title>`, meta description, and Open
Graph tags — without it, every quiz/post page would share the same
generic site-wide metadata even after being correctly listed in the
sitemap, which weakens search snippet quality and click-through even once
indexed.

## Payments (Flutterwave, platform-collects model)

Cliniolab collects 100% of every payment directly into its own Flutterwave
account — there's no per-creator subaccount and no automatic splitting at
checkout time. This applies to both paid quizzes and (optionally) paid
resources. `src/lib/payments/flutterwaveClient.ts` is the only file
allowed to call Flutterwave directly.

### Paid quizzes

Any quiz — Study, Quiz, or Exam/CBT mode — can be marked free or paid at
creation.

- Price is set in Naira; the creator sees a live earnings preview while
  typing ("You'll earn ₦X of every ₦Y sale") based on the admin-configured
  platform fee percentage (`/admin/payments`).
- On purchase, the buyer pays Cliniolab directly via Flutterwave checkout.
  Once verified, the creator's cut is credited to `creator_balance_kobo`
  on their user record — it does **not** go to their bank automatically.
- Creators register payout bank details at `/dashboard/payout-setup`
  (verified via Flutterwave's account-resolution API) so a transfer can
  be sent later, but this is only needed before their *first withdrawal*,
  not before their first sale.
- `/dashboard/earnings` shows the creator's withdrawable balance and a
  **Request payout** button. Requesting debits the balance immediately
  (so it can't be requested twice) and creates a `payout_requests` row.
- **Every payout request is reviewed by admin** at `/admin/payments` —
  there is no auto-approval. Admin picks, per request, how to fulfill it:
  - **Flutterwave**: triggers a real transfer via the Transfers API
    immediately, no further steps.
  - **Manual**: admin has already paid the creator outside the system
    (e.g. a bank app) and just marks the request as paid.
  - If a Flutterwave transfer fails, the amount is automatically refunded
    back onto the creator's balance so it's never lost.
- The whole paid-quiz capability, and the commission percentage, are
  admin-controlled at `/admin/payments`.

### Paid resources (books, past-question packs, etc.)

Resources are uploaded directly by admin/moderators — there's no creator
split here, since admin *is* the seller. What's configurable is how
**all** resource purchases are collected, via a single site-wide setting
at `/admin/payments`:

- **Manual** (default): buyer transfers outside the app, uploads a
  screenshot as proof, and an admin/moderator manually confirms or
  rejects the purchase — unchanged from before.
- **Flutterwave**: buyer pays through a real Flutterwave checkout and the
  purchase unlocks automatically the moment payment is verified — no
  admin step at all.

This is a platform-wide switch, not per-resource — admin picks one mode
and it governs every paid resource going forward.

### Webhook setup (required)

Client-side redirect verification alone isn't reliable — if a buyer closes
their browser tab immediately after paying, the purchase can get stuck
`pending` forever with no other signal that the money actually arrived.
The webhook at `/api/webhooks/flutterwave` is the fix: Flutterwave calls
it directly the moment a payment or transfer completes, independent of
whether the buyer's browser ever came back.

To enable it:
1. In the Flutterwave dashboard, go to **Settings → Webhooks**.
2. Set the webhook URL to `https://<your-domain>/api/webhooks/flutterwave`.
3. Set a **Secret Hash** (any random string you choose) and check the
   boxes for **Charge completed** and **Transfer completed** events.
4. Put that same secret hash in `FLUTTERWAVE_WEBHOOK_HASH` in your
   deployed environment variables — the handler rejects any request whose
   `verif-hash` header doesn't match exactly.

The handler always re-verifies the transaction/transfer against
Flutterwave's API before trusting it (never acts on the webhook payload
directly), and is safe to receive duplicate deliveries — Flutterwave
doesn't guarantee exactly-once delivery, so this matters in practice, not
just in theory.

### Notes

- Flutterwave supports multiple businesses under one account, so the same
  company can run separate Flutterwave businesses for Cliniolab, Zamorax,
  etc. — each with its own KYC and settlement account.
- Payment confirmation runs through two paths that reinforce each other:
  the buyer's browser redirect (`/quizzes/purchase-success`,
  `/resources/purchase-success`) calls `/verify` immediately for a fast
  UI response, and the webhook independently confirms the same
  transaction shortly after as a safety net. Either one completing the
  purchase is sufficient; both are idempotent, so there's no harm if both
  fire.

## Leaderboards (three levels)

- **General** (homepage) — top 16 across every category
- **Category** — top 16 within one top-level category, shown on that
  category's page (`/categories/group/[categorySlug]`)
- **Per-quiz** — top 16 scorers on one specific quiz/exam, shown on that
  quiz's detail page

All three are independently admin-toggleable.

## Homepage structure

Hero → Daily Quiz banner → one 2-column section per blog category (4 +
"See more" each) → one section per quiz category (4 + "See more" each) →
General Leaderboard → Books & Past Questions → Homepage Video → Footer.

Blog categories are fixed: General Medicine, Clinical Scenarios, Nursing,
Anatomy, Physiology, Pharmacology, Scholarship, Job, Others — Scholarship
and Job replaced the earlier JoblifyHQ cross-link integration, which was
removed since that project is currently on hold.

## Quiz modes

Three modes, chosen by the creator at quiz creation:

- **Study Mode** — no timer, no final score, no persisted attempt.
  Each question reveals the correct answer and explanation immediately
  after answering, then moves to the next. Pure learning — never touches
  the leaderboard or dashboard history. Fetches full question data
  (including answers) via a dedicated `/api/quizzes/[id]/study` endpoint
  that only serves quizzes actually set to Study Mode, and for private
  quizzes additionally requires the current valid share slug (same
  expiry rules as everywhere else).
- **Quiz Mode** — untimed, graded at the end like a normal quiz.
- **Exam / CBT Mode** — timed (computer-based test simulation),
  auto-submits when time runs out, supports shuffle question/option
  order. This is the mode marketing copy calls "CBT" since that's the
  term students commonly search for.

## Sharing

The `ShareButton` component (used on public quizzes and blog posts) offers
native device share (or clipboard-copy fallback) plus a dedicated WhatsApp
share button, since WhatsApp is the dominant share channel for the
Nigerian audience.

## PWA

The app is installable (manifest + service worker at `public/sw.js`) and
supports push notifications once a VAPID key pair is configured:
```bash
npx web-push generate-vapid-keys
```
Add the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and keep the private
key server-side for whatever sends pushes (comment-reply notifications,
etc. — the send-side isn't wired up yet; only subscribe/unsubscribe and
the service worker's push handler are in place).

## Logo

`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico`,
and `og-image.png` are a **placeholder wordmark** (navy rounded square,
teal pulse-line, "C" monogram) generated to keep the PWA manifest and SEO
tags valid. Swap these files with real brand assets whenever you have them
— same filenames, same sizes (192×192, 512×512, 180×180 for apple-touch,
1200×630 for og-image).
