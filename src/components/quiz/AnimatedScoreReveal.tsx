// src/components/quiz/AnimatedScoreReveal.tsx
'use client';

/**
 * Feature #5 - Animated score reveal + shareable PNG.
 *
 * Pure client-side. On mount, animates a count-up from 0 to the final
 * percentage over ~1 second, then renders a "Share as image" button
 * that uses the canvas API to draw a Cliniolab-branded result card
 * (with watermark) and triggers a download / share via the Web Share
 * API if available, with a clipboard-image fallback.
 *
 * No database, no API calls. The PNG is generated entirely in the
 * browser from the already-loaded AttemptResult.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface AnimatedScoreRevealProps {
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  quizTitle: string;
  /** Pass an accent color for the ring; defaults to Cliniolab pulse teal. */
  accentColor?: string;
}

export function AnimatedScoreReveal({
  percentage,
  correctCount,
  totalQuestions,
  quizTitle,
  accentColor = '#2f8f7a',
}: AnimatedScoreRevealProps) {
  const [displayed, setDisplayed] = useState(0);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'unsupported'>('idle');
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Math.round(percentage)));
    const start = performance.now();
    const duration = 1000;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(target * eased));
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(target);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [percentage]);

  function drawSharePng(): string | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, 1080, 1080);

    // Top navy block
    ctx.fillStyle = '#0B1F2E';
    ctx.fillRect(0, 0, 1080, 220);

    // Logo monogram
    ctx.fillStyle = '#2f8f7a';
    ctx.fillRect(80, 70, 80, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('C', 120, 122);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const titleText = quizTitle.length > 40 ? quizTitle.slice(0, 38) + '...' : quizTitle;
    ctx.fillText(titleText, 200, 110);
    ctx.fillStyle = '#87a5b3';
    ctx.font = '20px Inter, system-ui, sans-serif';
    ctx.fillText('Cliniolab quiz result', 200, 145);

    // Score ring
    const cx = 540;
    const cy = 600;
    const r = 220;
    ctx.lineWidth = 36;
    ctx.strokeStyle = '#e8eef1';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    const pct = Math.max(0, Math.min(100, percentage)) / 100;
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Score number
    ctx.fillStyle = '#0B1F2E';
    ctx.font = 'bold 130px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(percentage)}%`, cx, cy);

    // Correct / total
    ctx.fillStyle = '#4c7386';
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillText(`${correctCount} of ${totalQuestions} correct`, cx, cy + 110);

    // Footer
    ctx.fillStyle = '#0B1F2E';
    ctx.fillRect(0, 980, 1080, 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cliniolab · Nursing & Clinical Exam Practice', 80, 1035);
    ctx.fillStyle = '#2f8f7a';
    ctx.textAlign = 'right';
    ctx.fillText('cliniolab.com', 1000, 1035);

    return canvas.toDataURL('image/png');
  }

  async function handleShare() {
    const dataUrl = drawSharePng();
    if (!dataUrl) {
      setShareStatus('unsupported');
      return;
    }

    try {
      // Convert data URL to a Blob for Web Share API.
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const file = new File([blob], 'cliniolab-result.png', { type: 'image/png' });

      // Web Share API with file support (mobile mostly).
      if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
        const navAny = navigator as Navigator & { canShare: (data: { files: File[] }) => boolean };
        if (navAny.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Cliniolab quiz result',
            text: `I scored ${Math.round(percentage)}% on "${quizTitle}"`,
            files: [file],
          });
          setShareStatus('shared');
          return;
        }
      }

      // Fallback: download the PNG and copy a text snippet.
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'cliniolab-result.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(
            `I scored ${Math.round(percentage)}% on "${quizTitle}" at Cliniolab`,
          );
        } catch {
          // Clipboard write may be blocked; the PNG download is the primary path.
        }
      }
      setShareStatus('copied');
    } catch {
      setShareStatus('unsupported');
    }
  }

  const color = percentage >= 70 ? '#2f8f7a' : percentage >= 50 ? '#d4892a' : '#c4442e';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative grid h-32 w-32 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${displayed}%, #e8eef1 ${displayed}% 100%)`,
          boxShadow: '0 0 0 6px rgba(255,255,255,0.9), 0 8px 20px rgba(15,37,49,0.08)',
        }}
        aria-label={`Score ${displayed} percent`}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white shadow-inner">
          <span className="font-mono text-2xl font-semibold text-ink-900">{displayed}%</span>
        </div>
      </div>
      <p className="text-sm text-ink-500">
        {correctCount} of {totalQuestions} correct
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleShare}
        className="mt-1"
        aria-label="Share your result as an image"
      >
        {shareStatus === 'shared' ? 'Shared!' : shareStatus === 'copied' ? 'Image saved' : 'Share as image'}
      </Button>
      {shareStatus === 'unsupported' && (
        <p className="text-xs text-ink-400">Your browser does not support image sharing.</p>
      )}
    </div>
  );
}
