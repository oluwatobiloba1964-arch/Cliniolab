// src/components/quiz/ShareButton.tsx
'use client';

import { useState } from 'react';

export interface ShareStats {
  creatorName?: string | null;
  creatorContact?: string | null;
  mode?: 'study' | 'quiz' | 'exam';
  priceKobo?: number | null;
  pricing?: 'free' | 'paid';
  timeLimitSeconds?: number | null;
  questionCount?: number;
  retakePolicy?: 'unlimited' | 'single' | 'daily_limit' | 'cooldown';
  retakeLimit?: number | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  categoryName?: string;
  subcategoryName?: string;
  attemptCount?: number;
  averageScorePercent?: number | null;
}

const MODE_LABELS: Record<NonNullable<ShareStats['mode']>, string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'CBT (Computer-Based Test) Mode',
};

const DIFFICULTY_LABELS: Record<NonNullable<ShareStats['difficulty']>, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return 'No limit';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatTrials(stats: ShareStats): string {
  switch (stats.retakePolicy) {
    case 'single':
      return '1 time';
    case 'daily_limit':
      return `${stats.retakeLimit ?? 1} time${stats.retakeLimit === 1 ? '' : 's'} per day`;
    case 'cooldown':
      return `${stats.retakeLimit ?? 1} time${stats.retakeLimit === 1 ? '' : 's'} (cooldown applies)`;
    case 'unlimited':
    default:
      return 'Unlimited';
  }
}

/** Builds the full share payload: title, mode, category, price, time, trials, and URL. */
export function buildShareText(title: string, url: string, stats?: ShareStats): string {
  if (!stats) return `${title}\n${url}`;

  const lines: string[] = [];
  lines.push(title + (stats.creatorName ? ` by ${stats.creatorName}` : ''));
  if (stats.mode) {
    lines.push(`Available in: ${MODE_LABELS[stats.mode]}`);
  }

  const category = [stats.categoryName, stats.subcategoryName].filter(Boolean).join(' > ');
  if (category) {
    lines.push(`Category: ${category}`);
  }
  if (stats.difficulty) {
    lines.push(`Difficulty: ${DIFFICULTY_LABELS[stats.difficulty]}`);
  }

  lines.push('');
  lines.push(
    `Price: ${stats.pricing === 'paid' && stats.priceKobo ? formatNaira(stats.priceKobo) : 'Free'}`
  );
  lines.push(`Estimated time: ${formatDuration(stats.timeLimitSeconds)}`);
  if (typeof stats.questionCount === 'number') {
    lines.push(`Questions: ${stats.questionCount}`);
  }
  lines.push(`Trials allowed: ${formatTrials(stats)}`);

  // Only show attempt stats once a meaningful number of people have taken
  // it - "0 attempts" or a single early attempt reads as a red flag
  // rather than social proof, so we hold off until there is something to show.
  if (typeof stats.attemptCount === 'number' && stats.attemptCount >= 5) {
    const avg =
      typeof stats.averageScorePercent === 'number' ? ` · Avg score ${Math.round(stats.averageScorePercent)}%` : '';
    lines.push(`${stats.attemptCount.toLocaleString('en-NG')} attempts${avg}`);
  }

  lines.push('');
  lines.push('an e-test at Cliniolab');

  if (stats.creatorContact) {
    lines.push(`For inquiries or assistance, contact: ${stats.creatorContact}`);
  }

  lines.push('');
  lines.push(url);

  return lines.join('\n');
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

export function ShareButton({
  url,
  title,
  stats,
  showWhatsApp = true,
  className,
}: {
  url: string;
  title: string;
  stats?: ShareStats;
  /** Dashboard usage hides the WhatsApp button to keep the row compact. */
  showWhatsApp?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!url) return;
    const text = buildShareText(title, url, stats);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // Pass url separately too: most share targets append it after `text`,
        // matching how Cliniolab's own forwarded share message is structured.
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled the share sheet; fall through to clipboard copy
      }
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleWhatsAppShare() {
    if (!url) return;
    const text = encodeURIComponent(buildShareText(title, url, stats));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={`inline-flex flex-wrap gap-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleShare}
        disabled={!url}
        title={copied ? 'Copied full share message' : 'Share with title, mode, price, time, and link'}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? 'Copied!' : 'Share'}
      </button>
      {showWhatsApp && (
        <button
          type="button"
          onClick={handleWhatsAppShare}
          disabled={!url}
          className="inline-flex items-center gap-1.5 rounded-md border border-pulse-200 bg-white px-3 py-1.5 text-xs font-medium text-pulse-700 shadow-sm transition hover:bg-pulse-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Share to WhatsApp with full details"
        >
          WhatsApp
        </button>
      )}
    </div>
  );
}
