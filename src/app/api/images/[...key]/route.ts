// FILE: src/app/api/images/[...key]/route.ts
import { NextResponse } from 'next/server';
import { getImageObject } from '@/lib/storage/r2Client';

interface RouteParams {
  params: Promise<{ key: string[] }>;
}

// Serves images uploaded via /api/uploads/image back out. uploadImage()
// returns paths shaped like /api/images/blog/<uuid>.png — the key in R2
// is everything after /api/images/, which is why this is a catch-all
// segment ([...key]) rather than a single [key]: keys always contain a
// slash (purpose/filename).
//
// FIX (Vercel Fluid Active CPU cost) - this route used to stream every
// image's bytes through a serverless function (one invocation + full CPU
// time per image load, which dwarfed every other cost driver on a
// content-heavy site like this one). All first-party consumers now
// resolve /api/images/<key> to the R2 bucket's public URL directly via
// resolveImageUrl()/resolveImageUrlsInHtml() (see
// src/lib/storage/imageUrl.ts), so the browser loads images straight
// from R2/CDN and never hits this route for them.
//
// This route stays only as a fallback/alias for anything that still has
// a bare /api/images/... URL (an old cached page, an external link, a
// stored path from before R2_PUBLIC_URL was configured) — it 301s
// straight to the public URL instead of fetching and re-streaming the
// object, so even a fallback hit costs a redirect, not a function body
// read. If R2_PUBLIC_URL isn't configured, it falls back to the old
// streaming behavior so images still work (just without the CPU
// savings) rather than breaking outright.
export async function GET(_request: Request, { params }: RouteParams) {
  const { key } = await params;
  const objectKey = key.join('/');

  const publicBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL)?.replace(/\/+$/, '');
  if (publicBase) {
    return NextResponse.redirect(`${publicBase}/${objectKey}`, 301);
  }

  const object = await getImageObject(objectKey);
  if (!object) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  return new NextResponse(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Uploaded images are content-addressed by a random UUID and never
      // overwritten in place, so it's safe to cache aggressively.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
