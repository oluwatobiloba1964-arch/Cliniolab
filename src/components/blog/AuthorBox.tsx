// src/components/blog/AuthorBox.tsx
import Image from 'next/image';
import type { AuthorBoxSetting } from '@/types';

interface Props {
  authorName?: string | null;
  authorCredentials?: string | null;
  authorPhotoUrl?: string | null;
  reviewerName?: string | null;
  reviewerCredentials?: string | null;
  reviewerPhotoUrl?: string | null;
  setting: AuthorBoxSetting;
}

/** Byline + optional "Medically reviewed by" line, shown under a blog post for trust (E-E-A-T). */
export function AuthorBox({
  authorName,
  authorCredentials,
  authorPhotoUrl,
  reviewerName,
  reviewerCredentials,
  reviewerPhotoUrl,
  setting,
}: Props) {
  if (!setting.showAuthorBox || !authorName) return null;

  return (
    <div className="mt-10 rounded-md border border-ink-100 p-4">
      <div className="flex items-center gap-3">
        {authorPhotoUrl ? (
          <Image src={authorPhotoUrl} alt={authorName} width={56} height={56} className="rounded-full object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-pulse-50 font-display text-base font-semibold text-pulse-600">
            {authorName.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-ink-800">
            Written by {authorName}
            {authorCredentials && <span className="font-normal text-ink-500">, {authorCredentials}</span>}
          </p>
          {setting.showReviewer && reviewerName && (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
              {reviewerPhotoUrl && (
                <Image src={reviewerPhotoUrl} alt={reviewerName} width={28} height={28} className="rounded-full object-cover" />
              )}
              {setting.reviewerLabel} {reviewerName}
              {reviewerCredentials && `, ${reviewerCredentials}`}
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-400">
        See our{' '}
        <a href={setting.editorialPolicyUrl} className="underline hover:text-ink-600">editorial policy</a>
        {setting.showReviewer && (
          <>
            {' '}and{' '}
            <a href={setting.medicalReviewPolicyUrl} className="underline hover:text-ink-600">medical review policy</a>
          </>
        )}
        .
      </p>
    </div>
  );
}
