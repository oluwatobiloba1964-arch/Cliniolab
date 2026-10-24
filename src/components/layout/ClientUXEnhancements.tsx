// FILE: src/components/layout/ClientUXEnhancements.tsx
'use client';
// File: src/components/layout/ClientUXEnhancements.tsx

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Home, CheckSquare, Layers, PenLine, Search, Bookmark, LayoutDashboard } from 'lucide-react';

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/', label: 'Home', icon: <Home className="h-5 w-5" aria-hidden="true" /> },
  { href: '/quizzes', label: 'Quizzes', icon: <CheckSquare className="h-5 w-5" aria-hidden="true" /> },
  { href: '/flashcards', label: 'Cards', icon: <Layers className="h-5 w-5" aria-hidden="true" /> },
  { href: '/blog', label: 'Articles', icon: <PenLine className="h-5 w-5" aria-hidden="true" /> },
];

const ACTIONS: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/quizzes', label: 'Browse quizzes', icon: <CheckSquare className="h-4 w-4" aria-hidden="true" /> },
  { href: '/flashcards', label: 'Study flashcards', icon: <Layers className="h-4 w-4" aria-hidden="true" /> },
  { href: '/blog', label: 'Read articles', icon: <PenLine className="h-4 w-4" aria-hidden="true" /> },
  { href: '/guest', label: 'Guest practice', icon: <CheckSquare className="h-4 w-4" aria-hidden="true" /> },
  { href: '/abbreviations', label: 'Abbreviations & glossary', icon: <Search className="h-4 w-4" aria-hidden="true" /> },
  { href: '/resources', label: 'Resources library', icon: <Layers className="h-4 w-4" aria-hidden="true" /> },
  { href: '/jobs', label: 'Jobs board', icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
  { href: '/scholarships', label: 'Scholarships', icon: <Bookmark className="h-4 w-4" aria-hidden="true" /> },
  { href: '/leaderboard', label: 'Leaderboard', icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
  { href: '/search', label: 'Search Cliniolab', icon: <Search className="h-4 w-4" aria-hidden="true" /> },
  { href: '/dashboard/bookmarks', label: 'Open bookmarks', icon: <Bookmark className="h-4 w-4" aria-hidden="true" /> },
  { href: '/dashboard', label: 'Open dashboard / study space', icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
  { href: '/offline', label: 'Offline saved items', icon: <Layers className="h-4 w-4" aria-hidden="true" /> },
];

export function ClientUXEnhancements() {
  const [showTop, setShowTop] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [readingProgress, setReadingProgress] = useState(0);
  const [readingPage, setReadingPage] = useState(false);
  const [offline, setOffline] = useState(false);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  const [recent, setRecent] = useState<{ href: string; title: string }[]>([]);

  useEffect(() => {
    const update = () => {
      setShowTop(window.scrollY > 500);
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setReadingProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery('');
      }
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    // Mobile Chrome's online/offline events AND navigator.onLine are both
    // unreliable across network switches (wifi<->cellular) and while the
    // tab is backgrounded - either can report "online" when there's no
    // real route to the internet, or simply not fire, leaving the
    // "Offline" pill stuck even once the connection is back. So instead of
    // trusting those signals alone, verify real connectivity with a tiny
    // no-store network probe whenever we think the state may have changed.
    let probeToken = 0;
    const probeConnectivity = async () => {
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      const token = ++probeToken;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeout);
        if (token === probeToken) setOffline(false);
      } catch {
        if (token === probeToken) setOffline(true);
      }
    };
    const onOnline = () => probeConnectivity();
    const onOffline = () => setOffline(true);
    const resync = () => {
      if (document.visibilityState === 'visible') void probeConnectivity();
    };
    let pollId: number | null = null;
    const startPolling = () => {
      if (pollId !== null || document.visibilityState !== 'visible') return;
      pollId = window.setInterval(resync, 60_000);
    };
    const stopPolling = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void resync();
        startPolling();
      } else {
        stopPolling();
      }
    };
    // Connectivity checks are local static-asset probes, not API reads. Run
    // them once per minute while visible and stop entirely in background tabs.
    startPolling();
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event); };
    setReadingPage(window.location.pathname.startsWith('/blog/'));
    try {
      const saved = JSON.parse(localStorage.getItem('cliniolab-recent-pages') || '[]');
      if (Array.isArray(saved)) setRecent(saved.slice(0, 6));
    } catch {}
    const path = window.location.pathname;
    if (path !== '/') {
      try {
        const current = { href: path, title: document.title || path };
        const saved = JSON.parse(localStorage.getItem('cliniolab-recent-pages') || '[]');
        const next = [current, ...(Array.isArray(saved) ? saved : []).filter((x: { href?: string }) => x?.href !== path)].slice(0, 6);
        localStorage.setItem('cliniolab-recent-pages', JSON.stringify(next));
        setRecent(next);
      } catch {}
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    probeConnectivity();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      stopPolling();
    };
  }, []);

  const filteredActions = ACTIONS.filter((item) => item.label.toLowerCase().includes(paletteQuery.trim().toLowerCase()));
  const filteredRecent = recent.filter((item) => item.title.toLowerCase().includes(paletteQuery.trim().toLowerCase()) || item.href.toLowerCase().includes(paletteQuery.trim().toLowerCase()));

  async function installApp() {
    const event = installEvent as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> }) | null;
    if (!event?.prompt) return;
    await event.prompt();
    setInstallEvent(null);
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {readingPage && readingProgress > 0 && <div className="reading-progress" style={{ width: `${readingProgress}%` }} aria-hidden="true" />}
      {offline && <div className="offline-pill" role="status">Offline · cached content may still be available</div>}
      {installEvent && <button type="button" onClick={installApp} className="install-pill">Install Cliniolab</button>}
      <button type="button" className="command-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open quick actions">
        <span className="inline-flex"><Search className="h-4 w-4" aria-hidden="true" /></span><span className="hidden sm:inline">Quick actions</span><kbd>Ctrl K</kbd>
      </button>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>
        ))}
      </nav>
      <button type="button" className={`back-to-top ${showTop ? 'back-to-top-visible' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>

      {paletteOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Quick actions" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
          <div className="command-panel">
            <div className="flex items-center gap-3 border-b border-ink-100 p-3">
              <span className="text-ink-400"><Search className="h-5 w-5" aria-hidden="true" /></span>
              <input autoFocus value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Search actions…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <kbd>Esc</kbd>
            </div>
            <div className="p-2">
              {filteredActions.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setPaletteOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-700 hover:bg-ink-50">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-pulse-50 text-pulse-700">{item.icon}</span>{item.label}<span className="ml-auto text-ink-300">→</span>
                </Link>
              ))}
              {filteredActions.length === 0 && <p className="p-4 text-sm text-ink-400">No actions found.</p>}
            </div>
            {filteredRecent.length > 0 && (
              <div className="border-t border-ink-100 p-2">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recently viewed</p>
                {filteredRecent.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setPaletteOpen(false)} className="block rounded-xl px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                    <span className="block truncate font-medium text-ink-800">{item.title}</span>
                    <span className="block truncate text-xs text-ink-400">{item.href}</span>
                  </Link>
                ))}
                <button type="button" onClick={() => { localStorage.removeItem('cliniolab-recent-pages'); setRecent([]); }} className="mt-1 w-full px-3 py-2 text-left text-xs font-semibold text-ink-400 hover:text-pulse-600">Clear recent pages</button>
              </div>
            )}
            <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">Press / or Ctrl/Cmd + K anytime</div>
          </div>
        </div>
      )}
    </>
  );
}
