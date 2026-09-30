// src/app/api/admin/blog/[id]/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { cmsService, userService } from '@/lib/db';
import { sendNewsletterForPost } from '@/lib/email/emailService';
import { sendBlogPushBroadcast } from '@/lib/push/pushNotificationService';
import { cleanupImagesAfterDelete } from '@/lib/storage/mediaCleanup';
import type { BlogContentFormat, BlogStatus } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await cmsService.getPostById(id);
  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  let body: Partial<{
    title: string;
    slug: string;
    content: string;
    contentFormat: BlogContentFormat;
    excerpt: string;
    status: BlogStatus;
    blogCategoryId: string;
    blogSubcategoryId: string | null;
    featuredImageUrl: string;
    seoTitle: string;
    seoDescription: string;
    isSponsored: boolean;
    isPinned: boolean;
    fullWidth: boolean;
    sendAsNewsletter: boolean;
    sendPush: boolean;
    authorName: string | null;
    authorCredentials: string | null;
    authorPhotoUrl: string | null;
    authorContributorId: string | null;
    authorBio: string | null;
    reviewerName: string | null;
    reviewerCredentials: string | null;
    reviewerPhotoUrl: string | null;
    reviewerContributorId: string | null;
    reviewerBio: string | null;
  }>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  await cmsService.updatePost(id, body);
  const updated = await cmsService.getPostById(id);

  // Both newsletter and push only ever fire on the actual draft ->
  // published transition (not on re-saving an already-published post),
  // and only once per post — guarded by the *_sent_at columns, checked
  // against `existing` (the pre-update row) rather than `updated`, so a
  // retry or double-click can't double-send either one.
  const nowPublishing = body.status === 'published' && existing.status !== 'published';

  if (updated && nowPublishing && updated.sendAsNewsletter && !existing.newsletterSentAt) {
    const recipients = await userService.adminListUsers();
    const excerpt = updated.excerpt || updated.content.replace(/[#*_>[\]()!-]/g, '').slice(0, 160) + '…';
    sendNewsletterForPost(updated.id, updated.title, updated.slug, excerpt, recipients)
      .then(() => cmsService.markNewsletterSent(updated.id))
      .catch(() => {});
  }

  if (updated && nowPublishing && updated.sendPush && !existing.pushSentAt) {
    const excerpt = updated.excerpt || updated.content.replace(/[#*_>[\]()!-]/g, '').slice(0, 160) + '…';
    sendBlogPushBroadcast(updated.title, excerpt, `/blog/${updated.slug}`, updated.featuredImageUrl)
      .then(() => cmsService.markPushSent(updated.id))
      .catch(() => {});
  }

  return NextResponse.json({ post: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { id } = await params;
  // Read before deleting: once the row is gone we can't tell which images
  // (cover + any embedded in the body) it was using.
  const existing = await cmsService.getPostById(id);
  await cmsService.deletePost(id);
  if (existing) {
    await cleanupImagesAfterDelete([existing.featuredImageUrl, existing.content], { table: 'blog_posts', id });
  }
  return NextResponse.json({ ok: true });
}
