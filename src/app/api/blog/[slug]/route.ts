import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const post = await cmsService.getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  return NextResponse.json(
    { post },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
