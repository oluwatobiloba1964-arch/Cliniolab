'use client';

import { useState } from 'react';
import { FlashcardRunner, type FlashcardRunnerCard } from './FlashcardRunner';
import { FlashcardLearn } from './FlashcardLearn';
import { FlashcardMatch } from './FlashcardMatch';
import { FlashcardTest } from './FlashcardTest';
import { usePublicConfig } from '@/lib/hooks/usePublicConfig';

type StudyMode = 'flip' | 'learn' | 'match' | 'test';

interface Props {
  cards: FlashcardRunnerCard[];
  title?: string;
  onDone?: () => void;
  /** Fires when any mode is completed (flip deck finished, learn mastered, match cleared, test submitted). */
  onComplete?: () => void;
  draftId?: string;
  shuffle?: boolean;
  /** Restrict to Flip only (used by the quiz "practice with flashcards" entry points). */
  flipOnly?: boolean;
}

/**
 * Mode picker for flashcards: Flip (the original runner), Learn, Match and
 * Test. Each of Learn, Match and Test can be switched off by an admin flag.
 */
export function FlashcardStudyHub({ cards, title, onDone, onComplete, draftId, shuffle, flipOnly }: Props) {
  const { flags } = usePublicConfig();
  const [mode, setMode] = useState<StudyMode>('flip');
  const [runKey, setRunKey] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => { document.body.classList.toggle('focus-session', focusMode); return () => document.body.classList.remove('focus-session'); }, [focusMode]);

  const modes: { key: StudyMode; label: string }[] = [{ key: 'flip', label: 'Flip' }];
  if (!flipOnly) {
    if (flags.flashcardLearn) modes.push({ key: 'learn', label: 'Learn' });
    if (flags.flashcardMatch) modes.push({ key: 'match', label: 'Match' });
    if (flags.flashcardTest) modes.push({ key: 'test', label: 'Test' });
  }

  const active = modes.some((m) => m.key === mode) ? mode : 'flip';

  return (
    <div className={focusMode ? 'study-focus-mode' : ''}>
      <div className="mx-auto flex max-w-xl justify-end px-6 pt-4">
        <button type="button" onClick={() => setFocusMode((value) => !value)} className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm hover:border-pulse-300 hover:text-pulse-700">
          {focusMode ? 'Exit focus mode' : 'Focus mode'}
        </button>
      </div>
      {modes.length > 1 && (
        <div className="mx-auto flex max-w-xl gap-1 overflow-x-auto px-6 pt-6">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMode(m.key);
                setRunKey((k) => k + 1);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm ${active === m.key ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600 hover:border-pulse-400'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {active === 'flip' && (
        <FlashcardRunner
          key={`flip-${runKey}`}
          cards={cards}
          title={title}
          onDone={onDone}
          onComplete={onComplete}
          draftId={draftId}
          shuffle={shuffle}
        />
      )}
      {active === 'learn' && (
        <FlashcardLearn key={`learn-${runKey}`} cards={cards} title={title} onDone={onDone} onComplete={onComplete} />
      )}
      {active === 'match' && (
        <FlashcardMatch
          key={`match-${runKey}`}
          cards={cards}
          title={title}
          bestTimeKey={draftId}
          onDone={onDone}
          onComplete={onComplete}
        />
      )}
      {active === 'test' && (
        <FlashcardTest key={`test-${runKey}`} cards={cards} title={title} onDone={onDone} onComplete={onComplete} />
      )}
    </div>
  );
}
