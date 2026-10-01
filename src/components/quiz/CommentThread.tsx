'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import type { Comment } from '@/types';

/** Lightweight relative-time formatter — no dependency needed for this. */
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Counts every comment in the tree, at any depth, for the header badge. */
function totalCount(comments: Comment[]): number {
  return comments.reduce((sum, c) => sum + 1 + (c.replies ? totalCount(c.replies) : 0), 0);
}

// Past this indent depth, replies stop stepping further right and instead
// render flush with depth 2, connected by a lighter/dashed line — this is
// the TikTok/Instagram trick that keeps long back-and-forth threads
// readable on a phone screen instead of marching off the right edge.
const MAX_VISUAL_INDENT = 2;

interface CommentThreadProps {
  /** API endpoint for this thread's comments, e.g. `/api/quizzes/{id}/comments` or `/api/blog/{id}/comments`. */
  endpoint: string;
  /** Placeholder copy for the top-level composer; defaults to quiz wording for backward compatibility. */
  placeholder?: string;
}

export function CommentThread({ endpoint, placeholder = 'Share your thoughts on this quiz…' }: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [loadError, setLoadError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  function loadComments() {
    fetch(endpoint, { cache: 'no-store' })
      .then(async (res) => {
        let data: { comments?: Comment[]; enabled?: boolean; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          throw new Error(`Bad response (${res.status}): could not parse JSON`);
        }
        if (!res.ok) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        setLoadError(null);
        setEnabled(data.enabled ?? true);
        setComments((prev) => {
          const next = data.comments ?? [];
          // Skip the state update (and re-render) on background polls
          // where nothing actually changed, so an in-progress reply
          // draft or expanded/collapsed state isn't disturbed.
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
      })
      .catch((err: Error) => {
        console.error('[CommentThread] loadComments failed:', endpoint, err);
        setLoadError(err.message || 'Failed to load comments');
      });
  }

  useEffect(() => {
    loadComments();

    // FIX (Vercel Hobby invocation/GB-hours budget) — src/components/quiz/CommentThread.tsx
    // Was: setInterval(loadComments, 8000) running unconditionally, even
    // with the tab backgrounded/minimized — every open tab was firing an
    // invocation of /api/comments every 8s forever. On Hobby that eats
    // through the monthly invocation + function-duration allowance fast
    // with very little real benefit (nobody reads comments that update
    // while they're not looking at the tab).
    // Now: 30s instead of 8s (~3.75x fewer polls), and the interval is only
    // running while the tab is actually visible — it's torn down on
    // backgrounding and restarted on refocus, so a backgrounded tab makes
    // zero polling requests. The refetch-on-focus/visibility behavior is
    // unchanged, so switching back to the tab still feels instant.
    const POLL_INTERVAL_MS = 30_000;
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval) return;
      interval = setInterval(loadComments, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadComments();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function postComment(text: string, parentCommentId?: string) {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setPostError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, parentCommentId }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON error body (e.g. a raw 500 HTML page); fall through to status-based message.
      }
      if (!res.ok) {
        const message = data.error ?? `Failed to post comment (${res.status})`;
        console.error('[CommentThread] postComment failed:', endpoint, res.status, data);
        setPostError(message);
        return;
      }
      setBody('');
      setReplyBody('');
      if (parentCommentId) {
        setExpanded((prev) => new Set(prev).add(parentCommentId));
      }
      setReplyTo(null);
      loadComments();
    } catch (err) {
      console.error('[CommentThread] postComment threw:', endpoint, err);
      setPostError(err instanceof Error ? err.message : 'Network error posting comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment and all its replies permanently?')) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) loadComments();
  }

  async function toggleLike(commentId: string) {
    if (!user) return;

    function applyToggle(list: Comment[]): Comment[] {
      return list.map((c) => {
        if (c.id === commentId) {
          return { ...c, likedByMe: !c.likedByMe, likeCount: c.likedByMe ? c.likeCount - 1 : c.likeCount + 1 };
        }
        if (c.replies) return { ...c, replies: applyToggle(c.replies) };
        return c;
      });
    }

    const previous = comments;
    setComments(applyToggle(comments));

    try {
      const res = await fetch(`/api/comments/${commentId}/reactions`, { method: 'POST' });
      if (!res.ok) setComments(previous);
    } catch {
      setComments(previous);
    }
  }

  function toggleExpanded(commentId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  if (!enabled) return null;

  const count = totalCount(comments);

  return (
    <div className="mt-12">
      <h3 className="font-display text-xl font-semibold text-ink-800">
        Comments{count > 0 ? ` (${count})` : ''}
      </h3>

      {loadError && (
        <p className="mt-3 rounded-md bg-critical-50 px-3 py-2 text-xs font-medium text-critical-600">
          Couldn&apos;t load comments: {loadError}
        </p>
      )}

      {user ? (
        <div className="mt-4 flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="flex-1 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button onClick={() => postComment(body)} disabled={submitting} className="self-end">
            Post
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-400">Log in to join the discussion.</p>
      )}

      {postError && (
        <p className="mt-2 rounded-md bg-critical-50 px-3 py-2 text-xs font-medium text-critical-600">
          Couldn&apos;t post comment: {postError}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {comments.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            depth={0}
            user={user}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            replyBody={replyBody}
            setReplyBody={setReplyBody}
            submitting={submitting}
            postComment={postComment}
            deleteComment={deleteComment}
            toggleLike={toggleLike}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
          />
        ))}
        {comments.length === 0 && <p className="text-sm text-ink-400">No comments yet.</p>}
      </div>
    </div>
  );
}

interface CommentNodeProps {
  comment: Comment;
  depth: number;
  user: ReturnType<typeof useAuth>['user'];
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyBody: string;
  setReplyBody: (v: string) => void;
  submitting: boolean;
  postComment: (text: string, parentCommentId?: string) => void;
  deleteComment: (id: string) => void;
  toggleLike: (id: string) => void;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
}

function CommentNode({
  comment,
  depth,
  user,
  replyTo,
  setReplyTo,
  replyBody,
  setReplyBody,
  submitting,
  postComment,
  deleteComment,
  toggleLike,
  expanded,
  toggleExpanded,
}: CommentNodeProps) {
  const replies = comment.replies ?? [];
  const isExpanded = expanded.has(comment.id);
  const shouldShowReplies = replies.length > 0 && (replies.length <= 2 || isExpanded);
  const visualDepth = Math.min(depth, MAX_VISUAL_INDENT);
  const isFlushed = depth >= MAX_VISUAL_INDENT;

  return (
    <div className={depth === 0 ? 'border-b border-ink-50 pb-5' : ''}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-700">{comment.authorName}</p>
          <span className="text-xs text-ink-400">{timeAgo(comment.createdAt)}</span>
        </div>
        {user && (user.id === comment.userId || user.role === 'admin' || user.role === 'moderator') && (
          <button
            onClick={() => deleteComment(comment.id)}
            className="text-xs text-critical-500 hover:text-critical-600"
          >
            Delete
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-600">{comment.body}</p>
      <div className="mt-1 flex items-center gap-4">
        <button
          onClick={() => toggleLike(comment.id)}
          disabled={!user}
          className={`flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed ${
            comment.likedByMe ? 'text-pulse-600' : 'text-ink-400 hover:text-pulse-600'
          }`}
        >
          <span aria-hidden>{comment.likedByMe ? '❤' : '♡'}</span>
          {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
        </button>
        {user && (
          <button
            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
            className="text-xs font-medium text-pulse-600 hover:text-pulse-700"
          >
            Reply
          </button>
        )}
      </div>

      {replyTo === comment.id && (
        <div className="mt-2 flex gap-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={`Reply to ${comment.authorName}…`}
            rows={2}
            className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={() => postComment(replyBody, comment.id)} disabled={submitting} className="self-end">
            Reply
          </Button>
        </div>
      )}

      {replies.length > 0 && !shouldShowReplies && (
        <button
          onClick={() => toggleExpanded(comment.id)}
          className="mt-2 ml-6 text-xs font-medium text-ink-400 hover:text-pulse-600"
        >
          — View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {shouldShowReplies && (
        <div
          className={`mt-3 space-y-3 border-l-2 pl-4 ${
            isFlushed ? 'ml-6 border-dashed border-ink-100' : 'ml-6 border-ink-50'
          }`}
        >
          {replies.length > 2 && isExpanded && (
            <button
              onClick={() => toggleExpanded(comment.id)}
              className="text-xs font-medium text-ink-400 hover:text-pulse-600"
            >
              — Hide replies
            </button>
          )}
          {replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={visualDepth + 1}
              user={user}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              submitting={submitting}
              postComment={postComment}
              deleteComment={deleteComment}
              toggleLike={toggleLike}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
