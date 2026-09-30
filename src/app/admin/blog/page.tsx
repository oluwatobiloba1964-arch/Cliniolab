'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { ImagePicker } from '@/components/ui/ImagePicker';
import { InlineImageManager } from '@/components/ui/InlineImageManager';
import { TiptapEditor, type TiptapEditorHandle } from '@/components/ui/TiptapEditor';
import { RawHtmlFrame } from '@/components/ui/RawHtmlFrame';
import type { BlogContentFormat, BlogPost, BlogStatus } from '@/types';
import { AuthorFields, type AuthorFieldsValue } from '@/components/blog/AuthorFields';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }
interface BlogSubcategoryOption { id: string; blogCategoryId: string; name: string; slug: string; sortOrder: number }

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Simple traffic-light guidance matching the convention most SEO plugins (Yoast, RankMath) use. */
function lengthHint(length: number, ideal: [number, number]): { label: string; color: string } {
  if (length === 0) return { label: 'Not set — will fall back to an auto-generated value', color: 'text-ink-400' };
  if (length < ideal[0]) return { label: `${length} characters — a bit short`, color: 'text-flag-600' };
  if (length > ideal[1]) return { label: `${length} characters — may get truncated in search results`, color: 'text-critical-500' };
  return { label: `${length} characters — good length`, color: 'text-pulse-600' };
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [content, setContent] = useState('');
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [excerpt, setExcerpt] = useState('');
  // Tiptap always authors real HTML, so new/edited posts are always saved
  // as 'html'. Existing 'markdown' posts already in the DB are unaffected
  // and still render via the old markdown path on the public blog page.
  const [contentFormat, setContentFormat] = useState<BlogContentFormat>('html');
  // When true, the Content field is a plain textarea (no Tiptap/ProseMirror
  // parsing, no editor-level sanitizeHtml call) so a full pasted HTML
  // document — <!DOCTYPE>, <head>, <style> with @media/*, etc. — is saved
  // byte-for-byte. Rendering safety for this path lives at render time in
  // BlogPostClient (sandboxed iframe), not at save time.
  const [isRawHtmlMode, setIsRawHtmlMode] = useState(false);
  // Raw HTML mode has no visual editor at all — it's a blind textarea
  // unless we render what's being typed. This controls which of the two
  // panes (or both) are visible; defaults to split so the preview is
  // never something the admin has to remember to open.
  const [rawHtmlView, setRawHtmlView] = useState<'split' | 'edit' | 'preview'>('split');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');

  // Fixed top-level category (required) — admin cannot add/remove these.
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [blogCategoryId, setBlogCategoryId] = useState<string>('');

  // Subcategory within the chosen category (optional, freely addable,
  // reused automatically if the typed name already exists for that
  // category).
  const [subcategories, setSubcategories] = useState<BlogSubcategoryOption[]>([]);
  const [blogSubcategoryId, setBlogSubcategoryId] = useState<string>('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  const [status, setStatus] = useState<BlogStatus>('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [fullWidth, setFullWidth] = useState(false);
  const [authorFields, setAuthorFields] = useState<AuthorFieldsValue>({
    authorName: '',
    authorCredentials: '',
    authorPhotoUrl: '',
    authorContributorId: '',
    reviewerName: '',
    reviewerCredentials: '',
    reviewerPhotoUrl: '',
    reviewerContributorId: '',
  });
  const [sendAsNewsletter, setSendAsNewsletter] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadError, setPostsLoadError] = useState(false);

  function load() {
    setPostsLoading(true);
    setPostsLoadError(false);
    fetch('/api/admin/blog')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load posts');
        return res.json();
      })
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => setPostsLoadError(true))
      .finally(() => setPostsLoading(false));
  }

  useEffect(load, []);

  // Recover an in-progress draft if the page was reloaded mid-edit — e.g.
  // Android reclaiming this WebView while the native file picker was open
  // for an in-content image insert. Only offers recovery when there is no
  // in-flight edit already (fresh page load) and something was actually
  // saved, so this never clobbers a normal fresh "New post" start.
  useEffect(() => {
    const saved = window.localStorage.getItem('cliniolab-blog-draft');
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as { title: string; content: string; excerpt: string; savedAt: number };
      if (!draft.content && !draft.title) return;
      const ageMinutes = Math.round((Date.now() - draft.savedAt) / 60000);
      const restore = window.confirm(
        `Recover unsaved draft "${draft.title || '(untitled)'}" from ${ageMinutes} minute(s) ago? This can happen after the editor reloads mid-edit (e.g. right after picking an image).`
      );
      if (restore) {
        setTitle(draft.title);
        setContent(draft.content);
        setExcerpt(draft.excerpt);
      } else {
        window.localStorage.removeItem('cliniolab-blog-draft');
      }
    } catch {
      window.localStorage.removeItem('cliniolab-blog-draft');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuously mirror the in-progress post to localStorage so a WebView
  // crash/reload never loses more than a few keystrokes. Cheap (title +
  // content + excerpt only) and debounced via the browser's own event loop
  // since this only runs on state changes, not on a timer.
  useEffect(() => {
    if (!title && !content) return;
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(
        'cliniolab-blog-draft',
        JSON.stringify({ title, content, excerpt, savedAt: Date.now() })
      );
    }, 500);
    return () => window.clearTimeout(handle);
  }, [title, content, excerpt]);

  const [categoriesLoadError, setCategoriesLoadError] = useState(false);

  function loadBlogCategories() {
    setCategoriesLoadError(false);
    fetch('/api/blog-categories')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load categories');
        return res.json();
      })
      .then((data) => {
        const cats: BlogCategoryOption[] = data.categories ?? [];
        setBlogCategories(cats);
        setBlogCategoryId((current) => current || cats[0]?.id || '');
      })
      .catch(() => setCategoriesLoadError(true));
  }

  useEffect(loadBlogCategories, []);

  // Reload the subcategory dropdown whenever the chosen top-level
  // category changes, and reset the selection (a subcategory from a
  // different category is never valid).
  function loadSubcategories(categoryId: string) {
    if (!categoryId) {
      setSubcategories([]);
      setBlogSubcategoryId('');
      return;
    }
    fetch(`/api/blog-subcategories?categoryId=${encodeURIComponent(categoryId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load subcategories');
        return res.json();
      })
      .then((data) => setSubcategories(data.subcategories ?? []))
      .catch(() => setSubcategories([]));
  }

  useEffect(() => {
    loadSubcategories(blogCategoryId);
    setBlogSubcategoryId('');
  }, [blogCategoryId]);

  async function addSubcategory() {
    if (!newSubcategoryName.trim() || !blogCategoryId) return;
    setError(null);
    const res = await fetch('/api/admin/blog-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blogCategoryId, name: newSubcategoryName }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewSubcategoryName('');
      loadSubcategories(blogCategoryId);
      setBlogSubcategoryId(data.subcategory.id);
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setContent('');
    setExcerpt('');
    setContentFormat('html');
    setIsRawHtmlMode(false);
    setRawHtmlView('split');
    setFeaturedImageUrl('');
    setBlogCategoryId(blogCategories[0]?.id || '');
    setBlogSubcategoryId('');
    setNewSubcategoryName('');
    setStatus('draft');
    setSeoTitle('');
    setSeoDescription('');
    setIsSponsored(false);
    setIsPinned(false);
    setFullWidth(false);
    setSendAsNewsletter(false);
    setSendPush(false);
    setAuthorFields({
      authorName: '',
      authorCredentials: '',
      authorPhotoUrl: '',
      authorContributorId: '',
      reviewerName: '',
      reviewerCredentials: '',
      reviewerPhotoUrl: '',
      reviewerContributorId: '',
    });
    setError(null);
    window.localStorage.removeItem('cliniolab-blog-draft');
  }

  function startEdit(post: BlogPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setSlugTouched(true); // don't auto-overwrite the slug while editing an existing post
    setContent(post.content);
    setIsRawHtmlMode(/^\s*<!DOCTYPE\s+html/i.test(post.content) || /^\s*<html[\s>]/i.test(post.content));
    setRawHtmlView('split');
    setExcerpt(post.excerpt ?? '');
    setContentFormat(post.contentFormat);
    setFeaturedImageUrl(post.featuredImageUrl ?? '');
    const categoryId = post.blogCategoryId ?? blogCategories[0]?.id ?? '';
    setBlogCategoryId(categoryId);
    loadSubcategories(categoryId);
    setBlogSubcategoryId(post.blogSubcategoryId ?? '');
    setStatus(post.status);
    setSeoTitle(post.seoTitle ?? '');
    setSeoDescription(post.seoDescription ?? '');
    setIsSponsored(post.isSponsored);
    setIsPinned(post.isPinned);
    setFullWidth(post.fullWidth);
    setAuthorFields({
      authorName: post.authorName ?? '',
      authorCredentials: post.authorCredentials ?? '',
      authorPhotoUrl: post.authorPhotoUrl ?? '',
      authorContributorId: post.authorContributorId ?? '',
      reviewerName: post.reviewerName ?? '',
      reviewerCredentials: post.reviewerCredentials ?? '',
      reviewerPhotoUrl: post.reviewerPhotoUrl ?? '',
      reviewerContributorId: post.reviewerContributorId ?? '',
    });
    setSendAsNewsletter(false); // never re-trigger a newsletter send just by opening an edit
    setSendPush(false); // never re-trigger a push send just by opening an edit
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removePost(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editingId === post.id) resetForm();
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to delete post.');
      }
    } catch {
      setError('Failed to delete post — check your connection and try again.');
    }
  }

  // Auto-derive the slug from the title until the admin manually edits
  // the slug field themselves — same UX WordPress uses.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const [saving, setSaving] = useState(false);

  async function savePost() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!content.trim()) {
      setError('Content is required.');
      return;
    }
    if (!blogCategoryId) {
      setError('Category is required.');
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      title,
      slug: slug || slugify(title),
      content,
      contentFormat,
      excerpt: excerpt || undefined,
      featuredImageUrl: featuredImageUrl || undefined,
      blogCategoryId,
      blogSubcategoryId: blogSubcategoryId || undefined,
      status,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      isSponsored,
      isPinned,
      fullWidth,
      authorName: authorFields.authorName || undefined,
      authorCredentials: authorFields.authorCredentials || undefined,
      authorPhotoUrl: authorFields.authorPhotoUrl || undefined,
      authorContributorId: authorFields.authorContributorId || undefined,
      reviewerName: authorFields.reviewerName || undefined,
      reviewerCredentials: authorFields.reviewerCredentials || undefined,
      reviewerPhotoUrl: authorFields.reviewerPhotoUrl || undefined,
      reviewerContributorId: authorFields.reviewerContributorId || undefined,
      sendAsNewsletter,
      sendPush,
    };
    try {
      const res = editingId
        ? await fetch(`/api/admin/blog/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        window.localStorage.removeItem('cliniolab-blog-draft');
        resetForm();
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to save post.');
      }
    } catch {
      setError('Failed to save post — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const titleHint = lengthHint((seoTitle || title).length, [40, 60]);
  const descriptionHint = lengthHint(seoDescription.length, [120, 160]);

  function categoryNameFor(post: BlogPost): string {
    if (post.blogCategoryId) {
      const match = blogCategories.find((c) => c.id === post.blogCategoryId);
      if (match) return match.name;
    }
    return post.category ?? 'Uncategorized';
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">
        {editingId ? 'Edit post' : 'Blog'}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Jobs and Scholarships listings are just posts tagged with those categories — pick them
        below like any other post.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <div>
          <label className="text-sm font-medium text-ink-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">URL slug</label>
          <div className="mt-1 flex items-center gap-1 text-sm text-ink-400">
            <span>/blog/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm text-ink-700 focus:border-pulse-400 focus:outline-none"
            />
          </div>
        </div>

        <ImagePicker value={featuredImageUrl} onChange={setFeaturedImageUrl} purpose="blog" label="Featured image" />

        <AuthorFields value={authorFields} onChange={setAuthorFields} />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-ink-700">Content</label>
            <Toggle
              checked={isRawHtmlMode}
              onChange={setIsRawHtmlMode}
              label="Raw HTML mode (paste a full HTML document as-is)"
            />
          </div>
          <div className="mt-1">
            {isRawHtmlMode ? (
              <div className="rounded-md border border-ink-100">
                <div className="flex items-center gap-1 border-b border-ink-100 bg-ink-50/50 p-1.5">
                  {(['edit', 'split', 'preview'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRawHtmlView(mode)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${
                        rawHtmlView === mode
                          ? 'bg-pulse-600 text-white'
                          : 'text-ink-600 hover:bg-ink-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div
                  className={
                    rawHtmlView === 'split'
                      ? 'grid grid-cols-1 divide-y divide-ink-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0'
                      : ''
                  }
                >
                  {rawHtmlView !== 'preview' && (
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={20}
                      placeholder="Paste a full HTML document here (<!DOCTYPE html>...). Saved exactly as pasted — no parsing, no stripping."
                      spellCheck={false}
                      className="w-full resize-y border-0 px-4 py-2 font-mono text-xs text-ink-700 focus:outline-none"
                    />
                  )}
                  {rawHtmlView !== 'edit' && (
                    <div className="max-h-[600px] overflow-auto bg-ink-50/30">
                      {content.trim() ? (
                        <RawHtmlFrame html={content} maxHeightPx={600} />
                      ) : (
                        <p className="p-4 text-xs text-ink-400">
                          Nothing to preview yet — paste or type HTML on the left.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <TiptapEditor
                ref={editorRef}
                value={content}
                onChange={setContent}
                uploadPurpose="blog"
                placeholder="Write your post…"
              />
            )}
          </div>
          {!isRawHtmlMode && (
            <div className="mt-2">
              <InlineImageManager
                purpose="blog"
                content={content}
                onInsertMarker={(marker) => editorRef.current?.insertTextAtCursor(marker)}
                onReplaceMarker={(marker, html) =>
                  setContent((current) => current.replace(marker, html))
                }
              />
            </div>
          )}
          {isRawHtmlMode && (
            <p className="mt-1 text-xs text-ink-400">
              Raw HTML mode bypasses the rich-text editor entirely — pasted content, including &lt;style&gt; blocks
              with @media queries, is saved unchanged and rendered in a sandboxed frame on the public page. The
              preview pane above renders the exact same way the published post will look.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            placeholder="Short summary shown on the blog listing page, in newsletters, and social previews. Falls back to an auto-generated excerpt from the content if left blank."
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">{excerpt.length} characters</p>
        </div>

        {/* SEO panel — WordPress/Yoast-style overrides, separate from the post title/content itself */}
        <div className="rounded-md border border-ink-100 p-4">
          <p className="text-sm font-semibold text-ink-700">Search appearance (SEO)</p>
          <div className="mt-3">
            <label className="text-xs font-medium text-ink-600">SEO title</label>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={title || 'Falls back to the post title above'}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
            />
            <p className={`mt-1 text-xs ${titleHint.color}`}>{titleHint.label}</p>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-ink-600">Meta description</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              placeholder="What shows up under the title in Google search results"
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
            />
            <p className={`mt-1 text-xs ${descriptionHint.color}`}>{descriptionHint.label}</p>
          </div>
        </div>

        {/* Category (required, fixed 12) + Subcategory (optional, freely addable & reused) */}
        <div className="rounded-md border border-ink-100 p-4">
          <p className="text-sm font-semibold text-ink-700">Category</p>
          {categoriesLoadError && (
            <p className="mt-1 text-xs text-critical-500">
              Couldn&apos;t load categories.{' '}
              <button type="button" onClick={loadBlogCategories} className="underline">Retry</button>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div>
              <label className="text-xs font-medium text-ink-600">Category (required)</label>
              <select
                value={blogCategoryId}
                onChange={(e) => setBlogCategoryId(e.target.value)}
                className="mt-1 block rounded-md border border-ink-100 px-3 py-1.5 text-sm"
              >
                {blogCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-600">Subcategory (optional)</label>
              <select
                value={blogSubcategoryId}
                onChange={(e) => setBlogSubcategoryId(e.target.value)}
                className="mt-1 block rounded-md border border-ink-100 px-3 py-1.5 text-sm"
              >
                <option value="">None</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
              placeholder="New subcategory name"
              className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
            />
            <Button size="sm" variant="secondary" onClick={addSubcategory}>Add subcategory</Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Subcategories you add are saved for this category and can be reused on future posts.
          </p>
        </div>

        <div className="rounded-md border border-ink-100 p-4">
          <label className="text-xs font-medium text-ink-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BlogStatus)}
            className="mt-1 block w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm sm:w-auto"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle checked={isSponsored} onChange={setIsSponsored} label="Sponsored" />
            <Toggle checked={isPinned} onChange={setIsPinned} label="Pinned" />
            <Toggle checked={fullWidth} onChange={setFullWidth} label="Full-width content (skip the narrow article column)" />
            <Toggle checked={sendAsNewsletter} onChange={setSendAsNewsletter} label="Send as newsletter" />
            <Toggle checked={sendPush} onChange={setSendPush} label="Send push notification" />
          </div>

          {sendAsNewsletter && status === 'draft' && (
            <p className="mt-3 text-xs text-flag-600">
              Newsletter only sends when status is Published — saving as Draft now won&apos;t email anyone yet.
            </p>
          )}

          {sendPush && status === 'draft' && (
            <p className="mt-3 text-xs text-flag-600">
              Push notification only sends when status is Published — saving as Draft now won&apos;t notify anyone yet.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="sm" onClick={savePost} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving…' : editingId ? 'Update post' : 'Save post'}
          </Button>
          {editingId && (
            <Button size="sm" variant="secondary" onClick={resetForm} className="w-full sm:w-auto">Cancel edit</Button>
          )}
        </div>
        {error && <p className="text-sm text-critical-500">{error}</p>}
      </Card>

      <div className="mt-8 space-y-3">
        {postsLoading && (
          <p className="text-sm text-ink-400">Loading posts…</p>
        )}
        {!postsLoading && postsLoadError && (
          <Card className="p-4">
            <p className="text-sm text-critical-500">Couldn&apos;t load posts — check your connection.</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={load}>Retry</Button>
          </Card>
        )}
        {!postsLoading && !postsLoadError && posts.length === 0 && (
          <p className="text-sm text-ink-400">No posts yet — create your first one above.</p>
        )}
        {!postsLoading && !postsLoadError && posts.map((post) => (
          <Card key={post.id} className={`p-4 ${editingId === post.id ? 'ring-2 ring-pulse-400' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink-800">{post.title}</p>
                  {post.isPinned && <span className="rounded bg-flag-50 px-2 py-0.5 text-xs text-flag-600">Pinned</span>}
                  {post.isSponsored && <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs text-pulse-600">Sponsored</span>}
                  {post.contentFormat === 'html' && (
                    <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">HTML</span>
                  )}
                </div>
                <p className="text-xs text-ink-400">
                  {categoryNameFor(post)} · {post.status} · {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => startEdit(post)}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => removePost(post)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
