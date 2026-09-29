import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { enforceRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { commentService, featureFlagService, quizService } from '@/lib/db';
import { sendCommentReplyEmail } from '@/lib/email/emailService';
import { sendCommentReplyPush } from '@/lib/push/pushNotificationService';

// See comment in the blog comments route for why this is needed —
// otherwise this GET can be served from a stale cache after a new
// comment is posted.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  try {
    const enabled = await featureFlagService.isFeatureEnabled('comments');
    if (!enabled) return NextResponse.json({ comments: [], enabled: false });

    const user = await getCurrentUser();
    const comments = await commentService.getCommentsForQuiz(quizId, user?.id);
    return NextResponse.json({ comments, enabled: true });
  } catch (err) {
    console.error('[GET /api/quizzes/:quizId/comments] failed', { quizId, err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load comments', comments: [], enabled: true },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
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

    const comment = await commentService.addComment(user.id, quizId, body.body.trim(), body.parentCommentId);

    // Notify the parent comment's author, unless they're replying to themselves.
    if (body.parentCommentId) {
      const parent = await commentService.getCommentById(body.parentCommentId);
      if (parent && parent.userId !== user.id) {
        const quiz = await quizService.getQuizById(quizId);
        if (quiz) {
          sendCommentReplyEmail(
            parent.userId,
            user.displayName ?? user.email,
            quiz.title,
            `/quizzes/${quizId}`,
            body.body.trim()
          ).catch(() => {});
          sendCommentReplyPush(
            parent.userId,
            user.displayName ?? user.email,
            quiz.title,
            `/quizzes/${quizId}`
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({ comment: { ...comment, authorName: user.displayName ?? user.email } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/quizzes/:quizId/comments] failed', { quizId, err });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to post comment' },
      { status: 500 }
    );
  }
}
