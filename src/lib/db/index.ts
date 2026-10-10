/**
 * Single import surface for all database access.
 *
 * Components, API routes, and server actions should import from
 * '@/lib/db' rather than reaching into individual service files or,
 * critically, the D1 client directly. This is what enforces the
 * service-abstraction requirement across the codebase.
 */

export * as categoryService from './services/categoryService';
export * as quizService from './services/quizService';
export * as attemptService from './services/attemptService';
export * as leaderboardService from './services/leaderboardService';
export * as leaderboardRankStateService from './services/leaderboardRankStateService';
export * as commentService from './services/commentService';
export * as reportService from './services/reportService';
export * as cmsService from './services/cmsService';
export * as certificateService from './services/certificateService';
export * as userService from './services/userService';
export * as featureFlagService from './services/featureFlagService';
export * as siteSettingsService from './services/siteSettingsService';
export * as dailyQuizService from './services/dailyQuizService';
export * as pushSubscriptionService from './services/pushSubscriptionService';
export * as resourceService from './services/resourceService';
export * as resourceCategoryService from './services/resourceCategoryService';
export * as emailLogService from './services/emailLogService';
export * as searchService from './services/searchService';
export * as feedbackService from './services/feedbackService';
export * as analyticsService from './services/analyticsService';
export * as quizPurchaseService from './services/quizPurchaseService';
export * as bannerService from './services/bannerService';
export * as payoutRequestService from './services/payoutRequestService';
export * as bookmarkService from './services/bookmarkService';
export * as abbreviationService from './services/abbreviationService';
export * as scholarService from './services/scholarService';
export * as flashcardService from './services/flashcardService';
export * as flashcardPurchaseService from './services/flashcardPurchaseService';
export * as flashcardAttemptService from './services/flashcardAttemptService';
export * as studyAttemptService from './services/studyAttemptService';
export * as mediaReferenceService from './services/mediaReferenceService';
export * as retentionService from './services/retentionService';

export { RetakeNotAllowedError } from './services/attemptService';
export * as blogCategoryService from './services/blogCategoryService';
export * as rateLimitService from './services/rateLimitService';
export * as platformSettingsService from './services/platformSettingsService';
export * as contributorService from './services/contributorService';
export * as guestService from './services/guestService';
export * as dataCleanService from './services/dataCleanService';
export * as clinicalPracticeService from './services/clinicalPracticeService';
