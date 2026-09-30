// ============================================
// USERS & ROLES
// ============================================

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  emailQuizResults: boolean;
  emailNewsletter: boolean;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  creatorBalanceKobo: number;
  payoutBankCode: string | null;
  payoutBankName: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
  contactPhone: string | null;
  /** Short bio shown on the creator's public profile page (/creator/[userId]). */
  bio: string | null;
  /** /api/images/avatars/<uuid>.<ext>, or null if no avatar uploaded. */
  avatarPath: string | null;
  createdAt: string;
}

// ============================================
// CATEGORIES
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

// ============================================
// QUIZZES
// ============================================

export type QuizMode = 'study' | 'quiz' | 'exam';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizVisibility = 'public' | 'private' | 'guest';
export type QuizStatus = 'draft' | 'published' | 'archived';
export type RetakePolicy = 'unlimited' | 'single' | 'daily_limit' | 'cooldown';
export type QuestionType = 'mcq' | 'true_false' | 'fill_blank';
export type LinkExpiryOption = '1d' | '3d' | '7d' | 'custom';
/**
 * How a private quiz's share link is gated:
 * - 'link': existing behavior, an expiring unguessable slug
 * - 'password': permanent slug, but the quiz-taker must also enter a
 *   creator-set password (changeable anytime) before starting
 */
export type QuizAccessMode = 'link' | 'password';

export interface Quiz {
  id: string;
  subcategoryId: string;
  creatorId: string;
  title: string;
  description: string | null;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  visibility: QuizVisibility;
  shareSlug: string | null;
  linkExpiresAt: string | null;
  /** Only meaningful when visibility === 'private'. Defaults to 'link'. */
  accessMode: QuizAccessMode;
  /** True when a password is currently set (never expose the hash to clients). */
  hasPassword: boolean;
  timeLimitSeconds: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  antiCheatEnabled: boolean;
  retakePolicy: RetakePolicy;
  retakeLimit: number | null;
  status: QuizStatus;
  pricing: 'free' | 'paid';
  priceKobo: number | null;
  allowFlagging: boolean;
  defaultMark: number;
  showMarks: boolean;
  /** Only meaningful when visibility === 'private'; ignored for public quizzes, which are governed solely by the global leaderboard_per_quiz admin flag. Lets the creator hide this quiz's own leaderboard from anyone with the link. */
  leaderboardEnabled: boolean;
  /** Anonymous count of guest completions (Guest Practice). No user ids are stored. */
  guestAttemptCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizWithStats extends Quiz {
  questionCount: number;
  attemptCount: number;
  /**
   * Completed Study Mode sessions (see study_attempts). Study Mode never
   * writes to quiz_attempts, so attemptCount is always 0 for study-mode
   * quizzes - this is the separate counter for those. Optional because
   * only getQuizzesWithStatsByIds currently populates it; other
   * QuizWithStats call sites don't fetch it.
   */
  studyAttemptCount?: number;
  averageScorePercent: number | null;
  commentCount: number;
  categoryName?: string;
  subcategoryName?: string;
  creatorName?: string;
  creatorContact?: string | null;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correctAnswer: string;
  explanation: string | null;
  /** Optional note on why the other (incorrect) options are wrong. */
  incorrectRationale?: string | null;
  sortOrder: number;
  /** Marks this question is worth. Null means "use the quiz's defaultMark". */
  mark: number | null;
}

export interface QuestionOption {
  id: string;
  text: string;
}

// Input shape used when creating/bulk-uploading quizzes
export interface QuizInput {
  subcategoryId: string;
  title: string;
  description?: string;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  visibility: QuizVisibility;
  linkExpiry?: LinkExpiryOption;
  customExpiryDate?: string; // ISO, required when linkExpiry === 'custom'
  timeLimitSeconds?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  antiCheatEnabled: boolean;
  retakePolicy: RetakePolicy;
  retakeLimit?: number;
  pricing?: 'free' | 'paid';
  priceKobo?: number;
  allowFlagging?: boolean;
  defaultMark?: number;
  showMarks?: boolean;
  /** Only meaningful when visibility === 'private'. Defaults to true. */
  leaderboardEnabled?: boolean;
  questions: QuizQuestionInput[];
}

export interface QuizQuestionInput {
  /** Present when editing an existing question so updates can preserve its id (and any attempt history/reports tied to it). Omit for new questions. */
  id?: string;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
  /** Optional note on why the other (incorrect) options are wrong. */
  incorrectRationale?: string;
  /** Marks this question is worth. Leave undefined/null to use the quiz's defaultMark. */
  mark?: number | null;
}

// ============================================
// ATTEMPTS
// ============================================

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  timeTakenSeconds: number | null;
  countsForLeaderboard: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  submittedAnswer: string | null;
  isCorrect: boolean;
}

export interface AttemptSubmission {
  quizId: string;
  /**
   * Question ids the client actually presented this attempt (e.g. the
   * narrowed set from a "retake missed only" run). Optional for backward
   * compatibility with any other caller; when present, grading and
   * totalQuestions/totalMarks are scoped to exactly this set instead of
   * every question in the quiz — otherwise a narrowed retake would
   * silently grade every question it didn't re-ask as wrong. See
   * submitAttempt in attemptService.ts.
   */
  questionIds?: string[];
  answers: { questionId: string; submittedAnswer: string }[];
  timeTakenSeconds: number;
}

export interface AttemptResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  /** Marks earned. Equal to score when every question is worth 1 mark. */
  marksEarned: number;
  /** Total marks available across the quiz (sum of each question's mark). */
  totalMarks: number;
  /** Whether the quiz creator has marks visible to quiz-takers. */
  showMarks: boolean;
  percentage: number;
  countedForLeaderboard: boolean;
  perQuestion: {
    questionId: string;
    prompt: string;
    submittedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string | null;
    incorrectRationale?: string | null;
    options: QuestionOption[];
    mark: number;
  }[];
}

// ============================================
// LEADERBOARD
// ============================================

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  quizzesTaken: number;
  averagePercentage: number;
  rank: number;
}

// ============================================
// COMMENTS
// ============================================

export interface Comment {
  id: string;
  quizId: string | null;
  blogPostId: string | null;
  userId: string;
  authorName: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies?: Comment[];
}

// ============================================
// REPORTS
// ============================================

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface QuestionReport {
  id: string;
  questionId: string;
  userId: string;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
}

/** A report joined with question/quiz context for creator and admin dashboards. */
export interface QuestionReportWithContext extends QuestionReport {
  questionPrompt: string;
  quizId: string;
  quizTitle: string;
  reporterName: string | null;
}

// ============================================
// BLOG / CMS
// ============================================

export type BlogStatus = 'draft' | 'published';

export type BlogContentFormat = 'markdown' | 'html';

export interface BlogPost {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  content: string;
  contentFormat: BlogContentFormat;
  excerpt: string | null;
  category: string | null; // legacy free-text tag, kept for old posts
  blogCategoryId: string | null;
  blogSubcategoryId: string | null;
  featuredImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: BlogStatus;
  isSponsored: boolean;
  isPinned: boolean;
  fullWidth: boolean;
  sendAsNewsletter: boolean;
  newsletterSentAt: string | null;
  sendPush: boolean;
  pushSentAt: string | null;
  /** Public byline shown on the post (E-E-A-T). Editable per post; falls back to the account display name. */
  authorName?: string | null;
  authorCredentials?: string | null;
  authorPhotoUrl?: string | null;
  authorContributorId?: string | null;
  /** Full bio shown in the author's profile card on the post. */
  authorBio?: string | null;
  /** Optional "Medically reviewed by" line. */
  reviewerName?: string | null;
  reviewerCredentials?: string | null;
  reviewerPhotoUrl?: string | null;
  reviewerContributorId?: string | null;
  /** Full bio shown in the reviewer's profile card on the post. */
  reviewerBio?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Outside writers/reviewers managed by admins. No login account needed. */
export interface Contributor {
  id: string;
  slug: string;
  name: string;
  credentials: string | null;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContributorInput {
  name: string;
  credentials?: string;
  title?: string;
  bio?: string;
  photoUrl?: string;
  isActive?: boolean;
}

export interface StaticPage {
  id: string; // 'about' | 'contact' | 'terms' | 'privacy' | 'faq' | 'disclaimer'
  title: string;
  content: string;
  updatedAt: string;
}

// ============================================
// FEATURE FLAGS
// ============================================

export type FeatureFlagKey =
  | 'leaderboard_general'
  | 'leaderboard_category'
  | 'leaderboard_per_quiz'
  | 'comments'
  | 'public_quiz_creation'
  | 'certificates'
  | 'flashcards'
  | 'homepage_video'
  | 'resources'
  | 'email_welcome'
  | 'email_leaderboard_recognition'
  | 'email_newsletter'
  | 'email_quiz_results'
  | 'email_comment_reply'
  | 'email_inactivity_nudge'
  | 'email_certificate_issued'
  | 'daily_quiz'
  | 'jobs_page'
  | 'scholarships_page'
  | 'medical_abbreviations'
  | 'scholar_of_the_day'
  | 'bookmarks'
  | 'site_search'
  | 'feedback_widget'
  | 'paid_quizzes'
  | 'banners_header'
  | 'banners_footer'
  | 'push_inactivity_nudge'
  | 'push_comment_reply'
  | 'push_daily_quiz'
  | 'push_blog_new_post'
  | 'guest_practice'
  | 'dark_mode'
  | 'offline_mode'
  | 'author_box'
  | 'flashcard_learn_mode'
  | 'flashcard_match_mode'
  | 'flashcard_test_mode';

export interface FeatureFlag {
  key: FeatureFlagKey;
  enabled: boolean;
  label: string | null;
}

// ============================================
// CERTIFICATES
// ============================================

export interface Certificate {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  scorePercentage: number;
  issuedAt: string;
}

// ============================================
// SITE SETTINGS (small admin-editable content blocks)
// ============================================

export interface CookieConsentSetting {
  enabled: boolean;
  message: string;
  policyLinkText: string;
  policyUrl: string;
  acceptButtonText: string;
  declineButtonText: string;
}

export interface HomepageVideoSetting {
  youtubeUrl: string;
  title: string;
  description: string;
}

/** How many related quizzes to show, and whether the section is shown at
 *  all, on the quiz detail page and blog post page respectively.
 *  `disabledCategoryIds` (blog page only) lets an admin turn off the
 *  related-quizzes widget for specific blog categories — e.g. Job,
 *  Scholarship, or Clinical Pearls — where a "related quiz" doesn't
 *  make sense, without turning it off site-wide. */
export interface RelatedQuizzesSetting {
  enabled: boolean;
  count: number;
  disabledCategoryIds?: string[];
}

/** Guest Practice: open access without an account. Nothing is saved to the database except an anonymous completion count. */
export type GuestCreatorAccess = 'admin_only' | 'admin_moderator' | 'all';

export interface GuestPracticeSetting {
  /** Max items in the homepage carousel. */
  homepageCount: number;
  autoplay: boolean;
  /** Seconds between automatic slides. */
  intervalSeconds: number;
  /** Who may set an item's visibility to Guest. */
  creatorAccess: GuestCreatorAccess;
  /** Section heading on the homepage. */
  sectionTitle: string;
  sectionSubtitle: string;
  /** Include guest items in the sitemap. */
  includeInSitemap: boolean;
}

export type ThemeDefault = 'system' | 'light' | 'dark';

export interface ThemeSetting {
  defaultTheme: ThemeDefault;
}

export interface OfflineSetting {
  /** Max items one device may keep offline. */
  maxItems: number;
  /** Allow offline copies of paid content the user owns. */
  allowPaid: boolean;
  /** Days before an offline copy is refreshed from the server when online. */
  refreshDays: number;
}

export interface AuthorBoxSetting {
  showAuthorBox: boolean;
  showReviewer: boolean;
  /** Text shown next to reviewer, e.g. "Medically reviewed by". */
  reviewerLabel: string;
  editorialPolicyUrl: string;
  medicalReviewPolicyUrl: string;
}

/** Admin "Data Clean" row: what it is, how much is stored, and how old data must be to be cleaned. */
export interface DataCleanTarget {
  key: string;
  label: string;
  description: string;
  rowCount: number;
  cleanableCount: number;
  defaultOlderThanDays: number;
}

/** How many related posts to show below a blog post, and whether the
 *  section is shown at all. Admin-controlled from the Related Content page. */
export interface RelatedPostsSetting {
  enabled: boolean;
  count: number;
}

// ============================================
// BANNERS (admin-managed CTA / advertising banners)
// ============================================

export type BannerPlacement = 'header' | 'footer';
export type BannerDisplayMode = 'static' | 'slider';

export interface Banner {
  id: string;
  placement: BannerPlacement;
  displayMode: BannerDisplayMode;
  title: string;
  imagePath: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Impression/click counts for a banner, shown in the admin list so you can report performance to a sponsor. */
export interface BannerStats {
  bannerId: string;
  impressionCount: number;
  clickCount: number;
  /** Click-through rate as a percentage, e.g. 2.35. Null if there have been no impressions yet. */
  ctrPercent: number | null;
}

// ============================================
// RESOURCES (Books & Past Question Packs)
// ============================================

export type ResourceKind = 'book' | 'past_question_pack';
export type ResourcePricing = 'free' | 'paid';
export type ResourceStatus = 'draft' | 'published' | 'archived';

/** Sub-category shown under the Book / Past Question Pack tabs, e.g. "OSCE". */
export interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface Resource {
  id: string;
  kind: ResourceKind;
  categoryId: string | null;
  categoryName: string | null; // denormalized for display, joined in from resource_categories
  categorySlug: string | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  institutionName: string | null;
  subjectTag: string | null;
  pricing: ResourcePricing;
  priceKobo: number | null;
  uploadedBy: string;
  status: ResourceStatus;
  createdAt: string;
  // Never includes driveLink unless the requesting user is entitled to it
  // (free resource, or paid + confirmed purchase, or admin/moderator).
}

export type PurchaseStatus = 'pending' | 'confirmed' | 'rejected';

export interface ResourcePurchase {
  id: string;
  resourceId: string;
  userId: string;
  proofImageUrl: string | null;
  txRef: string | null;
  flwTransactionId: string | null;
  status: PurchaseStatus;
  confirmedBy: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/** Site-wide setting controlling how ALL resource purchases are collected. */
export type ResourcePaymentMode = 'manual' | 'flutterwave';

/** What the client needs to render the correct download/pay button state. */
export interface ResourceAccessState {
  resource: Resource;
  access: 'download' | 'pay_to_unlock' | 'payment_pending' | 'payment_rejected';
}

// ============================================
// QUIZ PURCHASES (paid quizzes, Flutterwave — platform collects, creators withdraw via payout request)
// ============================================

export type PurchaseTransactionStatus = 'pending' | 'completed' | 'failed';

export interface QuizPurchase {
  id: string;
  quizId: string;
  buyerId: string;
  amountKobo: number;
  platformFeeKobo: number;
  creatorEarningKobo: number;
  txRef: string;
  flwTransactionId: string | null;
  status: PurchaseTransactionStatus;
  createdAt: string;
}

// ============================================
// FLASHCARDS (standalone flashcard sets, distinct from per-quiz flashcard practice)
// ============================================

export interface FlashcardSet {
  id: string;
  subcategoryId: string;
  creatorId: string;
  title: string;
  description: string | null;
  visibility: QuizVisibility;
  status: QuizStatus;
  pricing: 'free' | 'paid';
  priceKobo: number | null;
  shuffleCards: boolean;
  guestAttemptCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardSetWithStats extends FlashcardSet {
  cardCount: number;
  /** Number of completed study sessions (full run-throughs) - the flashcard equivalent of a quiz's attemptCount. */
  attemptCount: number;
  categoryName?: string;
  subcategoryName?: string;
  creatorName?: string;
}

export interface Flashcard {
  id: string;
  setId: string;
  front: string;
  back: string;
  explanation: string | null;
  sortOrder: number;
}

export interface FlashcardInput {
  subcategoryId: string;
  title: string;
  description?: string;
  visibility: QuizVisibility;
  pricing?: 'free' | 'paid';
  priceKobo?: number;
  shuffleCards?: boolean;
  cards: FlashcardCardInput[];
}

export interface FlashcardCardInput {
  id?: string;
  front: string;
  back: string;
  explanation?: string;
}

export interface FlashcardPurchase {
  id: string;
  setId: string;
  buyerId: string;
  amountKobo: number;
  platformFeeKobo: number;
  creatorEarningKobo: number;
  txRef: string;
  flwTransactionId: string | null;
  status: PurchaseTransactionStatus;
  createdAt: string;
}

export type PayoutMethod = 'flutterwave' | 'manual';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface PayoutRequest {
  id: string;
  creatorId: string;
  amountKobo: number;
  method: PayoutMethod | null;
  status: PayoutStatus;
  flwTransferId: string | null;
  adminNote: string | null;
  actionedBy: string | null;
  createdAt: string;
  actionedAt: string | null;
}

// ============================================
// FEEDBACK
// ============================================

export type FeedbackCategory = 'bug' | 'suggestion' | 'general';
export type FeedbackStatus = 'open' | 'reviewed' | 'resolved';

export interface Feedback {
  id: string;
  userId: string | null;
  category: FeedbackCategory;
  message: string;
  pageUrl: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

// ============================================
// DASHBOARD
// ============================================

export interface UserDashboardStats {
  totalAttempts: number;
  averagePercentage: number;
  bestPercentage: number;
  quizzesCreated: number;
  certificatesEarned: number;
  scoreHistory: { date: string; percentage: number; quizTitle: string }[];
}

// ============================================
// BOOKMARKS
// ============================================

export type BookmarkKind = 'quiz' | 'resource' | 'flashcard';

export interface Bookmark {
  id: string;
  userId: string;
  kind: BookmarkKind;
  targetId: string;
  createdAt: string;
}

// ============================================
// MEDICAL ABBREVIATIONS
// ============================================

export interface MedicalAbbreviation {
  id: string;
  abbreviation: string;
  meaning: string;
  category: string | null;
  isGlossary: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SCHOLAR OF THE DAY
// ============================================

export interface ScholarOfTheDay {
  id: string;
  studentUserId: string | null;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  achievement: string | null;
  quote: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}
