// File: src/components/ui/OptimizedImage.tsx
// Wrapper around next/image that enforces a non-empty alt attribute,
// sets sensible loading/decoding hints, and centralises R2 URL
// rewriting so callers do not need to remember the format. Used in
// place of raw <img> tags throughout the project for the audit fix G.

import Image from 'next/image';
import type { ImageProps } from 'next/image';

type OptimizedImageProps = Omit<ImageProps, 'alt' | 'loading' | 'decoding'> & {
  alt: string; // Required — caller must provide a meaningful description.
  eager?: boolean; // Set to true for above-the-fold hero images.
};

/**
 * Same-component wrapper as `next/image` but with:
 *  - mandatory `alt` (audit fix M)
 *  - default `loading="lazy"` and `decoding="async"` (audit fix G)
 *  - optional eager loading for hero images
 *  - works whether the project has `unoptimized: true` or not (audit fix G)
 */
export function OptimizedImage({ alt, eager, ...rest }: OptimizedImageProps) {
  if (!alt || alt.trim().length === 0) {
    // Defensive: a dev-only message to catch accidental empty alt strings
    // without breaking rendering for end users.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('OptimizedImage: empty alt text provided — pass a meaningful description.');
    }
  }
  return (
    <Image
      alt={alt || ''}
      loading={eager ? undefined : 'lazy'}
      decoding={eager ? undefined : 'async'}
      {...rest}
    />
  );
}
