// src/components/quiz/ReadAloudButton.tsx
'use client';

/**
 * Feature #14 - Read-aloud button for accessibility.
 *
 * Uses the browser's SpeechSynthesis API to read the given text out
 * loud. Critical for visually impaired students and mandatory for
 * clinical exam compliance. Feature-detected; no-ops on unsupported
 * browsers (desktops without TTS voices installed).
 *
 * No DB, no API calls. Pure browser API.
 */
import { useEffect, useRef, useState } from 'react';

interface ReadAloudButtonProps {
  text: string;
  /** Optional label override. Default: "Listen". */
  label?: string;
  /** Pass a smaller / ghost variant for inline use. */
  variant?: 'default' | 'ghost';
  className?: string;
}

export function ReadAloudButton({
  text,
  label = 'Listen',
  variant = 'default',
  className = '',
}: ReadAloudButtonProps) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported(typeof window.speechSynthesis === 'object' && typeof window.speechSynthesis.speak === 'function');
    return () => {
      // Cancel any in-flight speech when the component unmounts.
      if (typeof window.speechSynthesis !== 'undefined') {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Some browsers throw on cancelled speech; ignore.
        }
      }
    };
  }, []);

  if (!supported) return null;

  function toggleSpeak() {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    // Pick an English voice if available; some browsers ship locale-tagged voices.
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang.startsWith('en'));
    if (enVoice) u.voice = enVoice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-700'
      : 'inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-pulse-300 hover:text-pulse-700';

  return (
    <button
      type="button"
      onClick={toggleSpeak}
      aria-pressed={speaking}
      aria-label={speaking ? 'Stop reading aloud' : 'Read this question aloud'}
      className={`${base} ${className}`}
    >
      <span aria-hidden="true" className="text-sm">
        {speaking ? '⏸' : '🔊'}
      </span>
      {speaking ? 'Stop' : label}
    </button>
  );
}
