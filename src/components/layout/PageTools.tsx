'use client';

import { useEffect, useState } from 'react';

export function PageTools({ reading = false, focus = false }: { reading?: boolean; focus?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [focused, setFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem('cliniolab-text-scale') || '1');
    const next = Number.isFinite(saved) ? Math.min(1.15, Math.max(.9, saved)) : 1;
    setScale(next);
    document.documentElement.style.setProperty('--cliniolab-text-scale', String(next));
  }, []);

  function changeScale(next: number) {
    const value = Math.min(1.15, Math.max(.9, Number(next.toFixed(2))));
    setScale(value);
    localStorage.setItem('cliniolab-text-scale', String(value));
    document.documentElement.style.setProperty('--cliniolab-text-scale', String(value));
  }

  function toggleFocus() {
    const next = !focused;
    setFocused(next);
    document.body.classList.toggle('content-focus', next);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  if (!reading && !focus) return null;

  return (
    <div className="page-tools" aria-label="Page tools">
      <button type="button" onClick={() => setOpen((v) => !v)} className="page-tools-trigger">Tools</button>
      {open && (
        <div className="page-tools-panel">
          {reading && (
            <div className="page-tools-group">
              <span className="page-tools-label">Text size</span>
              <div className="page-tools-row">
                <button type="button" onClick={() => changeScale(scale - .05)} aria-label="Decrease text size">A-</button>
                <button type="button" onClick={() => changeScale(1)} aria-label="Reset text size">A</button>
                <button type="button" onClick={() => changeScale(scale + .05)} aria-label="Increase text size">A+</button>
              </div>
            </div>
          )}
          {focus && (
            <button type="button" className="page-tools-action" onClick={toggleFocus}>
              {focused ? 'Exit focus mode' : 'Focus mode'}
            </button>
          )}
          {reading && (
            <button type="button" className="page-tools-action" onClick={() => window.print()}>Print / save PDF</button>
          )}
          <button type="button" className="page-tools-action" onClick={share}>{copied ? 'Link copied' : 'Share page'}</button>
        </div>
      )}
    </div>
  );
}
