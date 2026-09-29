import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { enforceRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { commentService, cmsService, featureFlagService } from '@/lib/db';
import { sendCommentReplyEmail } from '@/lib/email/emailService';
import { sendCommentReplyPush } from '@/lib/push/pushNotificationService';

// Without this, Next.js can treat this GET handler as a static route
// (no dynamic request data is read directly), caching the response and
// serving stale comment lists — including "missing" a comment that was
// just posted seconds ago. Force it to run fresh on every request.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug: postId } = await params;
  try {
    const enabled = await featureFlagService.isFeatureEnabled('comments');
    if (!enabled) return NextResponse.json({ comments: [], enabled: false });

    const user = await getCurrentUser();
    const comments = await commentService.getCommentsForBlogPost(postId, user?.id);
    return NextResponse.json({ comments, enabled: true });
  } catch (err) {
    console.error('[GET /api/blog/:slug/comments] failed', { postId, err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load comments', comments: [], enabled: true },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug: postId } = await params;
  try {
    const enabled = await featureFlagService.isFeatureEnabled('comments');
    if (!enabled) return NextResponse.json({ error: 'Comments are currently disabled' }, { status: 403 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Login required to comment' }, { status: 401 });

    const limited = await enforceRateLimit(
      { name: 'comment-user', id: user.id, limit: 10, windowSeconds: 300 },
      { name: 'comment-ip', id: getClientIp(request), limit: 30, windowSeconds: 300 }
    );
    if (limited) return limited;

    let body: { body: string; parentCommentId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.body || !body.body.trim()) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
    }

    const comment = await commentService.addCommentToBlogPost(user.id, postId, body.body.trim(), body.parentCommentId);

    // Notify the parent comment's author, unless they're replying to themselves.
    if (body.parentCommentId) {
      const parent = await commentService.getCommentById(body.parentCommentId);
      if (parent && parent.userId !== user.id) {
        const post = await cmsService.getPostById(postId);
        if (post) {
          sendCommentReplyEmail(
            parent.userId,
            user.displayName ?? user.email,
            post.title,
            `/blog/${post.slug}`,
            body.body.trim()
          ).catch(() => {});
          sendCommentReplyPush(
            parent.userId,
            user.displayName ?? user.email,
            post.title,
            `/blog/${post.slug}`
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({ comment: { ...comment, authorName: user.displayName ?? user.email } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/blog/:slug/comments] failed', { postId, err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to post comment' },
      { status: 500 }
    );
  }
}
