'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { FlashcardRunnerCard } from './FlashcardRunner';
import { shuffled } from './flashcardUtils';

interface Props {
  cards: FlashcardRunnerCard[];
  title?: string;
  /** Used only to remember the best time on this device. */
  bestTimeKey?: string;
  onDone?: () => void;
  onComplete?: () => void;
}

interface Tile {
  key: string;
  pairId: string;
  text: string;
  side: 'front' | 'back';
}

const PAIRS_PER_ROUND = 6;

/**
 * Match mode. Tap a term, then its definition. Cards are played in rounds
 * of up to six pairs against a running timer. Best time is remembered in
 * localStorage on this device only.
 */
export function FlashcardMatch({ cards, title, bestTimeKey, onDone, onComplete }: Props) {
  const rounds = useMemo(() => {
    const order = shuffled(cards);
    const out: FlashcardRunnerCard[][] = [];
    for (let i = 0; i < order.length; i += PAIRS_PER_ROUND) out.push(order.slice(i, i + PAIRS_PER_ROUND));
    return out;
  }, [cards]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Tile | null>(null);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const completed = useRef(false);

  function buildRound(index: number) {
    const round = rounds[index] ?? [];
    const built: Tile[] = [];
    for (const c of round) {
      built.push({ key: `${c.id}-f`, pairId: c.id, text: c.front, side: 'front' });
      built.push({ key: `${c.id}-b`, pairId: c.id, text: c.back, side: 'back' });
    }
    setTiles(shuffled(built));
    setMatched(new Set());
    setSelected(null);
  }

  useEffect(() => {
    buildRound(roundIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIndex]);

  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 100) / 10), 100);
    return () => window.clearInterval(id);
  }, [finished]);

  function tap(tile: Tile) {
    if (matched.has(tile.pairId) || wrongKeys.length > 0) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.key === tile.key) {
      setSelected(null);
      return;
    }
    if (selected.pairId === tile.pairId && selected.side !== tile.side) {
      const nextMatched = new Set(matched).add(tile.pairId);
      setMatched(nextMatched);
      setSelected(null);
      if (nextMatched.size === (rounds[roundIndex]?.length ?? 0)) {
        if (roundIndex + 1 < rounds.length) {
          window.setTimeout(() => setRoundIndex((i) => i + 1), 450);
        } else {
          const total = Math.round((Date.now() - startedAt.current) / 100) / 10 + mistakes * 2;
          setElapsed(total);
          setFinished(true);
        }
      }
      return;
    }
    setMistakes((m) => m + 1);
    setWrongKeys([selected.key, tile.key]);
    setSelected(null);
    window.setTimeout(() => setWrongKeys([]), 600);
  }

  useEffect(() => {
    if (!finished || completed.current) return;
    completed.current = true;
    if (bestTimeKey) {
      try {
        const storageKey = `cl-match-best:${bestTimeKey}`;
        const prev = Number(window.localStorage.getItem(storageKey));
        if (!prev || elapsed < prev) window.localStorage.setItem(storageKey, String(elapsed));
        setBest(!prev || elapsed < prev ? elapsed : prev);
      } catch {
        setBest(null);
      }
    }
    onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function restart() {
    completed.current = false;
    startedAt.current = Date.now();
    setElapsed(0);
    setMistakes(0);
    setFinished(false);
    setRoundIndex(0);
    buildRound(0);
  }

  if (cards.length < 2) {
    return <p className="py-12 text-center text-sm text-ink-400">Match mode needs at least 2 cards.</p>;
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Match complete</p>
          <p className="mt-4 font-display text-3xl font-semibold text-ink-800">{elapsed.toFixed(1)}s</p>
          <p className="mt-2 text-sm text-ink-500">
            {mistakes} mistake{mistakes === 1 ? '' : 's'} (each adds 2 seconds)
            {best !== null && ` · Best on this device: ${best.toFixed(1)}s`}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={restart}>Play again</Button>
            {onDone && <Button onClick={onDone}>Done</Button>}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>Round {roundIndex + 1} of {rounds.length}</span>
        <span className="font-mono text-ink-600">{elapsed.toFixed(1)}s</span>
        {title && <span className="hidden font-mono text-xs uppercase tracking-widest text-pulse-600 sm:inline">{title}</span>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => {
          if (matched.has(tile.pairId)) {
            return <div key={tile.key} className="min-h-[76px] rounded-md border border-dashed border-ink-100 opacity-30" />;
          }
          const isSel = selected?.key === tile.key;
          const isWrong = wrongKeys.includes(tile.key);
          const style = isWrong
            ? 'border-critical-400 bg-critical-50 text-critical-500'
            : isSel
              ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
              : 'border-ink-100 bg-white text-ink-700 hover:border-pulse-400';
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => tap(tile)}
              className={`min-h-[76px] break-words rounded-md border p-3 text-left text-sm ${style}`}
            >
              {tile.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
