import Link from 'next/link';
import { Card, DifficultyBadge, difficultyEdgeClass } from '@/components/ui/Card';
import { ShareButton } from '@/components/quiz/ShareButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import type { QuizWithStats } from '@/types';

export function QuizCard({ quiz }: { quiz: QuizWithStats }) {
  return (
    <Link href={`/quizzes/${quiz.id}`}>
      <Card className={`p-5 transition-shadow hover:shadow-md ${difficultyEdgeClass(quiz.difficulty)}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink-800">{quiz.title}</h3>
          <div className="flex items-center gap-2">
            {quiz.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <DifficultyBadge difficulty={quiz.difficulty} />
            <BookmarkButton kind="quiz" targetId={quiz.id} />
          </div>
        </div>
        {quiz.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{quiz.description}</p>
        )}
        <div className="mt-4 flex items-center gap-4 font-mono text-xs text-ink-400">
          <span>{quiz.questionCount} Qs</span>
          <span>
            {quiz.mode === 'combined' ? 'Combined Mode' : quiz.mode === 'exam' ? 'Exam / CBT Mode' : quiz.mode === 'study' ? 'Study Mode' : 'Quiz Mode'}
          </span>
          {quiz.mode !== 'study' ? (
            <>
              <span title="Number of users who have taken this quiz">{quiz.attemptCount} attempts</span>
              {quiz.averageScorePercent !== null && (
                <span title="Average of each user's first attempt only">
                  Avg {Math.round(quiz.averageScorePercent)}% (1st try)
                </span>
              )}
            </>
          ) : (
            quiz.studyAttemptCount !== undefined && (
              <span title="Number of users who finished a Study Mode session">
                {quiz.studyAttemptCount} study attempts
              </span>
            )
          )}
          {quiz.commentCount > 0 && (
            <span>{quiz.commentCount} {quiz.commentCount === 1 ? 'comment' : 'comments'}</span>
          )}
        </div>
        {(quiz.categoryName || quiz.subcategoryName) && (
          <div className="mt-3 text-xs text-ink-400">
            {quiz.categoryName} {quiz.subcategoryName ? `· ${quiz.subcategoryName}` : ''}
          </div>
        )}
        {quiz.creatorName && (
          <div className="mt-1 text-xs text-ink-400">By {quiz.creatorName}</div>
        )}
        {quiz.visibility === 'public' && (
          <div
            className="mt-3"
            onClick={(e) => e.preventDefault()} // don't trigger the card's Link navigation
          >
            <ShareButton
              url={typeof window !== 'undefined' ? `${window.location.origin}/quizzes/${quiz.id}` : ''}
              title={quiz.title}
              stats={{
                creatorName: quiz.creatorName,
                creatorContact: quiz.creatorContact,
                mode: quiz.mode,
                pricing: quiz.pricing,
                priceKobo: quiz.priceKobo,
                timeLimitSeconds: quiz.timeLimitSeconds,
                questionCount: quiz.questionCount,
                retakePolicy: quiz.retakePolicy,
                retakeLimit: quiz.retakeLimit,
                difficulty: quiz.difficulty,
                categoryName: quiz.categoryName,
                subcategoryName: quiz.subcategoryName,
                attemptCount: quiz.attemptCount,
                averageScorePercent: quiz.averageScorePercent,
              }}
            />
          </div>
        )}
      </Card>
    </Link>
  );
}

/**
 * Large hero-style variant for the first/featured quiz in a section.
 * Keeps every essential stat QuizCard shows (Qs, mode, attempts, avg%,
 * comments, category, creator, share) — just presented bigger, matching
 * the magazine-style "featured post" layout used for blog sections.
 */
export function FeaturedQuizCard({ quiz }: { quiz: QuizWithStats }) {
  return (
    <Link href={`/quizzes/${quiz.id}`}>
      <Card className={`p-6 transition-shadow hover:shadow-md sm:p-8 ${difficultyEdgeClass(quiz.difficulty)}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold text-ink-800 sm:text-3xl">{quiz.title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {quiz.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <DifficultyBadge difficulty={quiz.difficulty} />
            <BookmarkButton kind="quiz" targetId={quiz.id} />
          </div>
        </div>
        {quiz.description && (
          <p className="mt-2 text-sm text-ink-500">{quiz.description}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-xs text-ink-400">
          <span>{quiz.questionCount} Qs</span>
          <span>
            {quiz.mode === 'combined' ? 'Combined Mode' : quiz.mode === 'exam' ? 'Exam / CBT Mode' : quiz.mode === 'study' ? 'Study Mode' : 'Quiz Mode'}
          </span>
          {quiz.mode !== 'study' ? (
            <>
              <span title="Number of users who have taken this quiz">{quiz.attemptCount} attempts</span>
              {quiz.averageScorePercent !== null && (
                <span title="Average of each user's first attempt only">
                  Avg {Math.round(quiz.averageScorePercent)}% (1st try)
                </span>
              )}
            </>
          ) : (
            quiz.studyAttemptCount !== undefined && (
              <span title="Number of users who finished a Study Mode session">
                {quiz.studyAttemptCount} study attempts
              </span>
            )
          )}
          {quiz.commentCount > 0 && (
            <span>{quiz.commentCount} {quiz.commentCount === 1 ? 'comment' : 'comments'}</span>
          )}
        </div>
        {(quiz.categoryName || quiz.subcategoryName) && (
          <div className="mt-3 text-xs text-ink-400">
            {quiz.categoryName} {quiz.subcategoryName ? `· ${quiz.subcategoryName}` : ''}
          </div>
        )}
        {quiz.creatorName && (
          <div className="mt-1 text-xs text-ink-400">By {quiz.creatorName}</div>
        )}
        {quiz.visibility === 'public' && (
          <div
            className="mt-4"
            onClick={(e) => e.preventDefault()} // don't trigger the card's Link navigation
          >
            <ShareButton
              url={typeof window !== 'undefined' ? `${window.location.origin}/quizzes/${quiz.id}` : ''}
              title={quiz.title}
              stats={{
                creatorName: quiz.creatorName,
                creatorContact: quiz.creatorContact,
                mode: quiz.mode,
                pricing: quiz.pricing,
                priceKobo: quiz.priceKobo,
                timeLimitSeconds: quiz.timeLimitSeconds,
                questionCount: quiz.questionCount,
                retakePolicy: quiz.retakePolicy,
                retakeLimit: quiz.retakeLimit,
                difficulty: quiz.difficulty,
                categoryName: quiz.categoryName,
                subcategoryName: quiz.subcategoryName,
                attemptCount: quiz.attemptCount,
                averageScorePercent: quiz.averageScorePercent,
              }}
            />
          </div>
        )}
      </Card>
    </Link>
  );
}

/**
 * Compact list-row variant for non-featured quizzes in a section. Trimmed
 * from the full card, but still surfaces every stat someone needs to
 * decide whether to tap in: Qs count, mode, attempts, avg%, difficulty,
 * price — nothing essential dropped, just no description/share/creator.
 */
export function CompactQuizCard({ quiz }: { quiz: QuizWithStats }) {
  return (
    <Link href={`/quizzes/${quiz.id}`}>
      <div className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-semibold text-ink-800">{quiz.title}</h4>
            {quiz.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <DifficultyBadge difficulty={quiz.difficulty} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-400">
            <span>{quiz.questionCount} Qs</span>
            <span>
              {quiz.mode === 'combined' ? 'Combined Mode' : quiz.mode === 'exam' ? 'Exam / CBT Mode' : quiz.mode === 'study' ? 'Study Mode' : 'Quiz Mode'}
            </span>
            {quiz.mode !== 'study' ? (
              <>
                <span title="Number of users who have taken this quiz">{quiz.attemptCount} attempts</span>
                {quiz.averageScorePercent !== null && (
                  <span title="Average of each user's first attempt only">
                    Avg {Math.round(quiz.averageScorePercent)}% (1st try)
                  </span>
                )}
              </>
            ) : (
              quiz.studyAttemptCount !== undefined && (
                <span title="Number of users who finished a Study Mode session">
                  {quiz.studyAttemptCount} study attempts
                </span>
              )
            )}
          </div>
          {quiz.creatorName && (
            <div className="mt-1 text-xs text-ink-400">By {quiz.creatorName}</div>
          )}
        </div>
        <div className="shrink-0" onClick={(e) => e.preventDefault()}>
          <BookmarkButton kind="quiz" targetId={quiz.id} />
        </div>
      </div>
    </Link>
  );
}
