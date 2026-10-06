'use client';
// File: src/components/layout/HomepageVideoSection.tsx

import { useEffect, useState } from 'react';
import type { HomepageVideoSetting } from '@/types';
import { getSiteWidgets } from '@/lib/client/siteWidgets';

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function HomepageVideoSection() {
  const [video, setVideo] = useState<HomepageVideoSetting | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getSiteWidgets()
      .then((data) => {
        setEnabled(data.homepageVideo.enabled);
        setVideo(data.homepageVideo.video);
      })
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled || !video || !video.youtubeUrl) return null;

  const videoId = extractYoutubeId(video.youtubeUrl);
  if (!videoId) return null;

  return (
    <section className="border-t border-ink-100 bg-ink-50/40">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-2 h-px w-full bg-chart-strip text-ink-200" aria-hidden />
        <h2 className="mt-8 font-display text-2xl text-ink-800 sm:text-3xl">{video.title}</h2>
        {video.description && (
          <p className="mt-2 max-w-2xl text-ink-500">{video.description}</p>
        )}
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border border-ink-100 shadow-sm">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
