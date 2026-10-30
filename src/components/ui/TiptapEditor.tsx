'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import CharacterCount from '@tiptap/extension-character-count';
import { Undo2, Redo2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
import { SlashMenu } from './editor/SlashMenu';
import { HtmlBlock } from './editor/HtmlBlock';
import { Figure } from './editor/Figure';
import { Embed, toEmbedUrl } from './editor/Embed';
import { Callout, type CalloutVariant } from './editor/Callout';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Where uploaded images should be filed under (matches /api/uploads/image "purpose"). */
  uploadPurpose?: 'blog' | 'resources' | 'banners' | 'scholars';
  minHeightPx?: number;
}

/** Imperative handle exposed via ref, for callers (like InlineImageManager)
 * that need to act on the live editor at a specific moment — e.g. drop a
 * plain-text marker at the current cursor — without owning the editor
 * instance themselves. Deliberately minimal: insertTextAtCursor is a
 * plain, synchronous ProseMirror text insert, nothing that depends on
 * anything still being in flight (no upload, no async work), so it's
 * safe to call at any point without the crash risk that motivated moving
 * image uploads out of the live editor's command chain in the first
 * place. */
export interface TiptapEditorHandle {
  insertTextAtCursor: (text: string) => void;
}

const HIGHLIGHT_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8'];
const TEXT_COLORS = ['#0F172A', '#DC2626', '#EA580C', '#16A34A', '#2563EB', '#7C3AED'];

/**
 * Rich WYSIWYG editor built on Tiptap (ProseMirror). Content is authored
 * as real HTML from the start, so what the admin sees while editing is
 * what gets rendered.
 *
 * Security: Tiptap's schema already constrains what nodes/marks can
 * exist, but as defense-in-depth every HTML snapshot from onUpdate is
 * still passed through sanitizeHtml() — the same function used at render
 * time — before it reaches onChange/persistence. New marks/nodes added
 * here (text-align, color, highlight, figure width/align, video embeds,
 * callouts) all serialize to tags/attrs/style-properties that
 * sanitizeHtml() explicitly allows; nothing here bypasses that boundary.
 */
export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(function TiptapEditor({
  value,
  onChange,
  placeholder = 'Write your post…',
  uploadPurpose = 'blog',
  minHeightPx = 320,
}, ref) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);


  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      setUploadError(null);
      if (!file.type.startsWith('image/')) {
        setUploadError('Only image files can be inserted.');
        return null;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', uploadPurpose);
        const res = await fetch('/api/uploads/image', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(data.error ?? 'Image upload failed.');
          return null;
        }
        return data.path as string;
      } catch {
        setUploadError('Image upload failed. Check your connection.');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [uploadPurpose]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noreferrer', target: '_blank' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      HtmlBlock,
      Figure,
      Embed,
      Callout,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(sanitizeHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-4',
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith('image/')) return false;
        event.preventDefault();
        uploadFile(file).then((path) => {
          if (!path || !editor) return;
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords?.pos ?? view.state.selection.from;
          editor.chain().focus().insertContentAt(pos, { type: 'figure', attrs: { src: path } }).run();
        });
        return true;
      },
      handlePaste(_view, event) {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        uploadFile(file).then((path) => {
          if (!path || !editor) return;
          editor.chain().focus().insertFigure({ src: path }).run();
        });
        return true;
      },
    },
  });

  // Keep editor content in sync if `value` changes externally (e.g. switching drafts).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      insertTextAtCursor: (text: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(text).run();
      },
    }),
    [editor]
  );

  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words?.() ?? 0;
  const charCount = editor.storage.characterCount?.characters?.() ?? 0;

  return (
    <div className="rounded-md border border-ink-100">
      <Toolbar
        editor={editor}
        onInsertImage={async (file) => {
          const path = await uploadFile(file);
          if (path) editor.chain().focus().insertFigure({ src: path }).run();
        }}
      />

      {uploadError && (
        <p className="border-b border-ink-100 bg-red-50 px-4 py-2 text-xs text-red-700">{uploadError}</p>
      )}
      {uploading && (
        <p className="border-b border-ink-100 bg-pulse-50 px-4 py-2 text-xs text-pulse-700">Uploading image…</p>
      )}

      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-0.5 rounded-md border border-ink-100 bg-white p-1 shadow-lg">
            <MarkButton editor={editor} mark="bold" label="B" />
            <MarkButton editor={editor} mark="italic" label="I" />
            <MarkButton editor={editor} mark="underline" label="U" />
            <MarkButton editor={editor} mark="strike" label="S" />

            <ColorSwatchPicker editor={editor} />
            <HighlightSwatchPicker editor={editor} />

            <button
              type="button"
              onClick={() => {
                const url = window.prompt('Link URL:', editor.getAttributes('link').href ?? '');
                if (url === null) return;
                if (url === '') {
                  editor.chain().focus().unsetLink().run();
                } else {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
              }}
              className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${editor.isActive('link') ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
              title="Link"
            >
              🔗
            </button>
          </div>
        </BubbleMenu>
      )}

      <div className="relative" style={{ minHeight: minHeightPx }}>
        <EditorContent editor={editor} />
        <SlashMenu
          editor={editor}
          onInsertImage={async (file) => {
            const path = await uploadFile(file);
            if (path) editor.chain().focus().insertFigure({ src: path }).run();
          }}
        />
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-3 py-1.5 text-[11px] text-ink-400">
        <span>{wordCount} words · {charCount} characters</span>
      </div>
    </div>
  );
});

function MarkButton({
  editor,
  mark,
  label,
}: {
  editor: Editor;
  mark: 'bold' | 'italic' | 'strike' | 'underline';
  label: string;
}) {
  const run = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    strike: () => editor.chain().focus().toggleStrike().run(),
    underline: () => editor.chain().focus().toggleUnderline().run(),
  }[mark];
  return (
    <button
      type="button"
      onClick={run}
      className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${editor.isActive(mark) ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
      title={label}
    >
      {label}
    </button>
  );
}

function ColorSwatchPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded px-2 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-100"
        title="Text color"
      >
        A
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-ink-100 bg-white p-1.5 shadow-lg">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                editor.chain().focus().setColor(c).run();
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full border border-ink-100"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
            className="ml-1 rounded px-1 text-[10px] text-ink-400 hover:bg-ink-100"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function HighlightSwatchPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${editor.isActive('highlight') ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
        title="Highlight"
      >
        ✎
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-ink-100 bg-white p-1.5 shadow-lg">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: c }).run();
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full border border-ink-100"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
            className="ml-1 rounded px-1 text-[10px] text-ink-400 hover:bg-ink-100"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onInsertImage }: { editor: Editor; onInsertImage: (file: File) => void }) {
  const fileInputId = 'tiptap-image-input';

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-100 bg-ink-50/50 p-2">
      <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={13} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('heading', { level: 3 })} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bold')} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>U</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarBtn>

      <Divider />

      <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft size={13} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter size={13} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight size={13} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn active={editor.isActive('blockquote')} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot;</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('codeBlock')} title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bulletList')} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarBtn>
      <ToolbarBtn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarBtn>
      <ToolbarBtn
        title="Insert table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        ⊞
      </ToolbarBtn>
      <ToolbarBtn title="Insert HTML block" onClick={() => editor.chain().focus().insertHtmlBlock().run()}>
        {'{ }'}
      </ToolbarBtn>

      <CalloutPicker editor={editor} />

      <ToolbarBtn
        title="Embed YouTube/Vimeo video"
        onClick={() => {
          const url = window.prompt('Paste a YouTube or Vimeo link:');
          if (!url) return;
          const embedUrl = toEmbedUrl(url);
          if (!embedUrl) {
            window.alert('That link isn\'t a recognized YouTube or Vimeo URL.');
            return;
          }
          editor.chain().focus().insertEmbed(embedUrl).run();
        }}
      >
        ▶
      </ToolbarBtn>

      <label htmlFor={fileInputId} className="cursor-pointer rounded px-2 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-100" title="Insert image">
        🖼
      </label>
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onInsertImage(file);
          e.target.value = '';
        }}
      />
      <div className="ml-auto flex items-center gap-1 text-[11px] text-ink-400">
        Type <kbd className="rounded border border-ink-200 bg-white px-1">/</kbd> for commands
      </div>
    </div>
  );
}

function CalloutPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const VARIANTS: { value: CalloutVariant; label: string }[] = [
    { value: 'info', label: 'ℹ️ Info' },
    { value: 'tip', label: '💡 Tip' },
    { value: 'warning', label: '⚠️ Warning' },
    { value: 'danger', label: '🚫 Danger' },
  ];
  return (
    <div className="relative">
      <ToolbarBtn title="Insert callout box" onClick={() => setOpen((o) => !o)}>
        ▣
      </ToolbarBtn>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-32 rounded-md border border-ink-100 bg-white p-1 shadow-lg">
          {VARIANTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => {
                editor.chain().focus().insertCallout(v.value).run();
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-ink-50"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-ink-200" />;
}

function ToolbarBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex items-center rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${active ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
    >
      {children}
    </button>
  );
}
