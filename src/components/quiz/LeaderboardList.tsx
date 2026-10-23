// File: src/components/quiz/LeaderboardList.tsx
import type { LeaderboardEntry } from '@/types';

/** Deterministic color for an initials avatar, based on the name itself
 *  so a given person always gets the same color across renders/pages. */
const AVATAR_PALETTE = [
  'bg-pulse-500',
  'bg-flag-500',
  'bg-ink-500',
  'bg-critical-400',
  'bg-pulse-700',
  'bg-flag-700',
] as const;

function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Small trophy glyph for #1, kept as inline SVG so no icon lib is needed. */
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7 5H4a3 3 0 0 0 3 3M17 5h3a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 12v3M9 19h6M10 19v-2.5a2 2 0 0 1 4 0V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MedalIcon({ rank, className }: { rank: 1 | 2 | 3; className?: string }) {
  const fill =
    rank === 1 ? 'text-flag-500' : rank === 2 ? 'text-ink-400' : 'text-flag-600';
  return (
    <span className={`inline-flex items-center justify-center ${fill} ${className ?? ''}`} aria-hidden="true">
      {rank === 1 ? (
        <TrophyIcon className="h-4 w-4" />
      ) : (
        <span className="font-mono text-[10px] font-bold tracking-tight">#{rank}</span>
      )}
    </span>
  );
}

/** Row-level accent for the top 3 using the existing palette. */
function rankStyles(rank: number): {
  row: string;
  badge: string;
  rankText: string;
  bar: string;
} {
  if (rank === 1) {
    return {
      row: 'bg-gradient-to-r from-flag-50/80 via-white to-white',
      badge: 'bg-flag-500 text-white shadow-sm shadow-flag-500/30',
      rankText: 'text-flag-600',
      bar: 'bg-flag-500',
    };
  }
  if (rank === 2) {
    return {
      row: 'bg-gradient-to-r from-ink-50/80 via-white to-white',
      badge: 'bg-ink-300 text-ink-800',
      rankText: 'text-ink-500',
      bar: 'bg-ink-400',
    };
  }
  if (rank === 3) {
    return {
      row: 'bg-gradient-to-r from-flag-50/40 via-white to-white',
      badge: 'bg-flag-200 text-flag-800',
      rankText: 'text-flag-600',
      bar: 'bg-flag-400',
    };
  }
  return {
    row: '',
    badge: 'bg-ink-50 text-ink-500',
    rankText: 'text-ink-400',
    bar: 'bg-pulse-500',
  };
}

export function LeaderboardList({
  entries,
  title,
  currentUserId,
  currentUserRank,
  primaryMetric = 'points',
}: {
  entries: LeaderboardEntry[];
  title: string;
  /** Signed-in visitor's id, if any - used to highlight their row inline. */
  currentUserId?: string | null;
  /**
   * Signed-in visitor's rank on this specific board, if known and outside
   * the visible `entries` list. Only render the "you're #N" nudge when
   * this is a real, fetched value - never estimate or invent a rank.
   */
  currentUserRank?: number | null;
  /**
   * Which number leads visually (larger/bolder) in each row.
   * 'points' (default) suits multi-quiz boards (general, category) where
   * total score reflects volume + consistency across many attempts.
   * 'average' suits a single-quiz board, where points and % are really
   * the same score twice - leading with accuracy reads more naturally
   * than leading with a raw point total for just one quiz.
   */
  primaryMetric?: 'points' | 'average';
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-flag-500">
          <TrophyIcon className="h-6 w-6" />
        </div>
        <p className="mt-3 font-display text-base font-semibold text-ink-800">No attempts yet</p>
        <p className="mt-1 text-sm text-ink-500">
          Be the first on the {title.toLowerCase()}. Take a quiz to claim the top spot.
        </p>
      </div>
    );
  }

  const viewerIsRanked = currentUserId != null && entries.some((e) => e.userId === currentUserId);
  const showViewerNudge =
    currentUserId != null && !viewerIsRanked && typeof currentUserRank === 'number';

  const maxPrimary = Math.max(
    1,
    ...entries.map((e) =>
      primaryMetric === 'points' ? e.totalScore : Math.round(e.averagePercentage)
    )
  );

  const topThree = entries.filter((e) => e.rank >= 1 && e.rank <= 3).slice(0, 3);
  const showPodium = topThree.length >= 2;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/80 via-white to-pulse-50/40 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-flag-50 text-flag-600 ring-1 ring-flag-100">
            <TrophyIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-ink-800">{title}</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
              {entries.length} ranked
            </p>
          </div>
        </div>
      </div>

      {showPodium && (
        <div className="grid grid-cols-3 gap-2 border-b border-ink-100 bg-ink-50/40 px-4 py-5 sm:gap-3 sm:px-6">
          {[1, 0, 2].map((podiumIndex) => {
            const entry = topThree.find((e) => e.rank === podiumIndex + 1);
            if (!entry) {
              return <div key={podiumIndex} className="min-h-[7rem]" />;
            }
            const isFirst = entry.rank === 1;
            const styles = rankStyles(entry.rank);
            const primary =
              primaryMetric === 'points'
                ? `${entry.totalScore} pts`
                : `${Math.round(entry.averagePercentage)}%`;
            return (
              <div
                key={entry.userId}
                className={`flex flex-col items-center rounded-xl border border-ink-100 bg-white px-2 py-3 text-center shadow-sm ${
                  isFirst ? 'sm:-mt-1 sm:pb-4' : 'mt-3 sm:mt-4'
                } ${
                  currentUserId != null && entry.userId === currentUserId
                    ? 'ring-2 ring-pulse-400'
                    : ''
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold ${styles.badge}`}
                >
                  {entry.rank <= 3 ? <MedalIcon rank={entry.rank as 1 | 2 | 3} /> : entry.rank}
                </span>
                <span
                  className={`mt-2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColorFor(
                    entry.displayName
                  )} ${isFirst ? 'h-12 w-12 text-sm ring-2 ring-flag-200' : ''}`}
                >
                  {initialsFor(entry.displayName)}
                </span>
                <p className="mt-2 line-clamp-2 w-full text-xs font-semibold text-ink-800 sm:text-sm">
                  {entry.displayName}
                </p>
                <p className="mt-1 font-mono text-xs font-semibold text-pulse-700 sm:text-sm">{primary}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">
                  {entry.quizzesTaken} {entry.quizzesTaken === 1 ? 'quiz' : 'quizzes'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <ol className="divide-y divide-ink-50">
        {entries.map((entry) => {
          const styles = rankStyles(entry.rank);
          const isViewer = currentUserId != null && entry.userId === currentUserId;
          const primaryValue =
            primaryMetric === 'points' ? entry.totalScore : Math.round(entry.averagePercentage);
          const barWidth = Math.max(6, Math.round((primaryValue / maxPrimary) * 100));

          return (
            <li
              key={entry.userId}
              className={`relative flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 ${styles.row} ${
                isViewer ? 'ring-1 ring-inset ring-pulse-400' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full font-mono text-xs font-semibold ${styles.badge}`}
                >
                  {entry.rank <= 3 ? <MedalIcon rank={entry.rank as 1 | 2 | 3} /> : entry.rank}
                </span>

                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${avatarColorFor(
                    entry.displayName
                  )}`}
                >
                  {initialsFor(entry.displayName)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink-800">{entry.displayName}</p>
                    {isViewer && (
                      <span className="rounded-full bg-pulse-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pulse-700">
                        You
                      </span>
                    )}
                    {entry.rank === 1 && (
                      <span className="rounded-full bg-flag-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-flag-700">
                        Leader
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {entry.quizzesTaken} {entry.quizzesTaken === 1 ? 'quiz' : 'quizzes'}
                  </p>
                  <div className="mt-1.5 h-1 max-w-[10rem] overflow-hidden rounded-full bg-ink-100 sm:max-w-[14rem]">
                    <div
                      className={`h-full rounded-full ${styles.bar}`}
                      style={{ width: `${barWidth}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                {primaryMetric === 'points' ? (
                  <>
                    <div className="text-sm font-semibold text-pulse-700">{entry.totalScore} pts</div>
                    <div className="text-[11px] text-ink-400">
                      {Math.round(entry.averagePercentage)}% avg
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-pulse-700">
                      {Math.round(entry.averagePercentage)}% avg
                    </div>
                    <div className="text-[11px] text-ink-400">{entry.totalScore} pts</div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {showViewerNudge && (
        <div className="border-t border-ink-100 bg-ink-50/70 px-5 py-3.5 text-sm text-ink-600">
          You are currently <span className="font-semibold text-ink-800">#{currentUserRank}</span>
          {' '}on this board. Take a quiz to climb higher.
        </div>
      )}
      {currentUserId == null && (
        <div className="border-t border-ink-100 bg-ink-50/70 px-5 py-3.5 text-sm text-ink-600">
          <a href="/register" className="font-medium text-pulse-600 hover:underline">
            Sign up
          </a>{' '}
          and take a quiz to get on the board.
        </div>
      )}
    </div>
  );
}
