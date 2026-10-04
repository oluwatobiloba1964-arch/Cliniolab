import { NextResponse } from 'next/server';
import { cmsService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const setting = await siteSettingsService.getRelatedPostsSetting();
  if (!setting.enabled) return NextResponse.json(
    { posts: [] },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );

  const post = await cmsService.getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const related = await cmsService.getRelatedPosts(post.id, post.blogCategoryId, setting.count);
  return NextResponse.json(
    { posts: related },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } }
  );
}
