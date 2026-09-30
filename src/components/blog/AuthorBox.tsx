// src/components/blog/AuthorBox.tsx
import Image from 'next/image';
import type { AuthorBoxSetting } from '@/types';

interface Props {
  authorName?: string | null;
  authorCredentials?: string | null;
  authorPhotoUrl?: string | null;
  authorBio?: string | null;
  reviewerName?: string | null;
  reviewerCredentials?: string | null;
  reviewerPhotoUrl?: string | null;
  reviewerBio?: string | null;
  setting: AuthorBoxSetting;
}

function ProfileCard({
  eyebrow,
  name,
  credentials,
  photoUrl,
  bio,
}: {
  eyebrow: string;
  name: string;
  credentials?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-full bg-ink-50 object-contain"
        />
      ) : (
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-pulse-50 font-display text-2xl font-semibold text-pulse-600">
          {name.charAt(0)}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{eyebrow}</p>
        <p className="mt-0.5 text-base font-semibold text-ink-800">
          {name}
          {credentials && <span className="font-normal text-ink-500">, {credentials}</span>}
        </p>
        {bio && <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{bio}</p>}
      </div>
    </div>
  );
}

/** True when the reviewer is the same person as the author — same name,
 * case/whitespace-insensitive. When they match, we show one combined
 * card instead of two identical ones. */
function sameContributor(authorName?: string | null, reviewerName?: string | null): boolean {
  if (!authorName || !reviewerName) return false;
  return authorName.trim().toLowerCase() === reviewerName.trim().toLowerCase();
}

/** Full author/reviewer profile card(s), shown under a blog post for trust (E-E-A-T).
 * If the author and reviewer are the same person, they're combined into a
 * single "Written / Medically reviewed by" card instead of two. */
export function AuthorBox({
  authorName,
  authorCredentials,
  authorPhotoUrl,
  authorBio,
  reviewerName,
  reviewerCredentials,
  reviewerPhotoUrl,
  reviewerBio,
  setting,
}: Props) {
  if (!setting.showAuthorBox || !authorName) return null;

  const hasReviewer = setting.showReviewer && !!reviewerName;
  const isSamePerson = hasReviewer && sameContributor(authorName, reviewerName);
  const showSeparateReviewer = hasReviewer && !isSamePerson;

  const reviewerLabel = setting.reviewerLabel || 'Medically reviewed by';
  const authorEyebrow = isSamePerson ? `Written / ${reviewerLabel}` : 'Written by';

  return (
    <div className="mt-10 space-y-6 rounded-md border border-ink-100 p-4">
      <ProfileCard
        eyebrow={authorEyebrow}
        name={authorName}
        credentials={authorCredentials}
        photoUrl={authorPhotoUrl}
        bio={authorBio || (isSamePerson ? reviewerBio : null)}
      />

      {showSeparateReviewer && (
        <div className="border-t border-ink-100 pt-4">
          <ProfileCard
            eyebrow={reviewerLabel}
            name={reviewerName as string}
            credentials={reviewerCredentials}
            photoUrl={reviewerPhotoUrl}
            bio={reviewerBio}
          />
        </div>
      )}

      <p className="text-xs text-ink-400">
        See our{' '}
        <a href={setting.editorialPolicyUrl} className="underline hover:text-ink-600">editorial policy</a>
        {hasReviewer && (
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
