'use client';

// FILE: src/app/admin/banners/page.tsx

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { ImagePicker } from '@/components/ui/ImagePicker';
import { resolveImageUrl } from '@/lib/storage/imageUrl';
import type { Banner, BannerPlacement, BannerDisplayMode, BannerStats } from '@/types';

const PLACEMENTS: { key: BannerPlacement; flagKey: 'banners_header' | 'banners_footer'; label: string; hint: string }[] = [
  {
    key: 'header',
    flagKey: 'banners_header',
    label: 'Header banner',
    hint: 'Long, full-width strip shown near the top of the homepage, under the hero section.',
  },
  {
    key: 'footer',
    flagKey: 'banners_footer',
    label: 'Footer banner',
    hint: 'Normal-sized banner shown above the footer links, on every page.',
  },
];

interface DraftBanner {
  title: string;
  imagePath: string;
  linkUrl: string;
  displayMode: BannerDisplayMode;
}

const EMPTY_DRAFT: DraftBanner = { title: '', imagePath: '', linkUrl: '', displayMode: 'static' };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [stats, setStats] = useState<Record<string, BannerStats>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<BannerPlacement, DraftBanner>>({
    header: { ...EMPTY_DRAFT },
    footer: { ...EMPTY_DRAFT },
  });
  const [saving, setSaving] = useState<BannerPlacement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [bannersRes, flagsRes] = await Promise.all([
      fetch('/api/admin/banners').then((r) => r.json()),
      fetch('/api/admin/flags').then((r) => r.json()),
    ]);
    setBanners(bannersRes.banners ?? []);
    setStats(bannersRes.stats ?? {});
    const flagMap: Record<string, boolean> = {};
    for (const f of flagsRes.flags ?? []) flagMap[f.key] = f.enabled;
    setFlags(flagMap);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleFlag(flagKey: string, enabled: boolean) {
    setFlags((prev) => ({ ...prev, [flagKey]: enabled }));
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: flagKey, enabled }),
    });
  }

  async function addBanner(placement: BannerPlacement) {
    const draft = drafts[placement];
    setError(null);
    if (!draft.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!draft.imagePath) {
      setError('Upload or paste an image before saving.');
      return;
    }
    setSaving(placement);
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placement,
          displayMode: draft.displayMode,
          title: draft.title.trim(),
          imagePath: draft.imagePath,
          linkUrl: draft.linkUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save banner');
        return;
      }
      setDrafts((prev) => ({ ...prev, [placement]: { ...EMPTY_DRAFT } }));
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function toggleBanner(banner: Banner) {
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, isActive: !b.isActive } : b)));
    await fetch(`/api/admin/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !banner.isActive }),
    });
  }

  async function changeDisplayMode(banner: Banner, displayMode: BannerDisplayMode) {
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, displayMode } : b)));
    await fetch(`/api/admin/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayMode }),
    });
  }

  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  async function deleteBanner(banner: Banner) {
    if (!confirm(`Delete "${banner.title}"? This can't be undone.`)) return;
    setDeleteWarning(null);
    setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    const res = await fetch(`/api/admin/banners/${banner.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (data?.warning) setDeleteWarning(data.warning);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Banners</h1>
      <p className="mt-2 text-ink-500">
        Upload CTA or advertising banners for the homepage header and site footer. Turn a whole
        placement off, or hide individual banners without deleting them.
      </p>
      {error && <p className="mt-3 text-sm text-critical-500">{error}</p>}
      {deleteWarning && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {deleteWarning}
        </div>
      )}

      {PLACEMENTS.map((placement) => {
        const placementBanners = banners.filter((b) => b.placement === placement.key);
        const draft = drafts[placement.key];
        return (
          <section key={placement.key} className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink-800">{placement.label}</h2>
                <p className="mt-0.5 text-sm text-ink-500">{placement.hint}</p>
              </div>
              <Toggle
                checked={flags[placement.flagKey] ?? true}
                onChange={(enabled) => toggleFlag(placement.flagKey, enabled)}
                label="Show on site"
              />
            </div>

            {/* Existing banners */}
            {placementBanners.length > 0 && (
              <div className="mt-4 space-y-3">
                {placementBanners.map((banner) => (
                  <Card key={banner.id} className="flex items-center gap-4 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveImageUrl(banner.imagePath)}
                      alt={banner.title}
                      className="h-16 w-28 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">{banner.title}</p>
                      {banner.linkUrl && (
                        <p className="truncate text-xs text-ink-400">{banner.linkUrl}</p>
                      )}
                      <BannerStatsLine stats={stats[banner.id]} />
                    </div>
                    <select
                      value={banner.displayMode}
                      onChange={(e) => changeDisplayMode(banner, e.target.value as BannerDisplayMode)}
                      className="rounded-md border border-ink-100 px-2 py-1.5 text-xs focus:border-pulse-400 focus:outline-none"
                    >
                      <option value="static">Static</option>
                      <option value="slider">Slider</option>
                    </select>
                    <Toggle checked={banner.isActive} onChange={() => toggleBanner(banner)} />
                    <Button size="sm" variant="danger" onClick={() => deleteBanner(banner)}>
                      Delete
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            {/* Add new */}
            <Card className="mt-4 space-y-4 p-5">
              <p className="text-sm font-medium text-ink-700">Add a new {placement.label.toLowerCase()}</p>
              <div>
                <label className="text-sm font-medium text-ink-700">Display type</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="radio"
                      name={`display-mode-${placement.key}`}
                      checked={draft.displayMode === 'static'}
                      onChange={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [placement.key]: { ...prev[placement.key], displayMode: 'static' },
                        }))
                      }
                      className="accent-pulse-500"
                    />
                    Static (always visible)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="radio"
                      name={`display-mode-${placement.key}`}
                      checked={draft.displayMode === 'slider'}
                      onChange={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [placement.key]: { ...prev[placement.key], displayMode: 'slider' },
                        }))
                      }
                      className="accent-pulse-500"
                    />
                    Slider (auto + manual rotation)
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-700">Title (internal label)</label>
                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [placement.key]: { ...prev[placement.key], title: e.target.value } }))
                  }
                  placeholder="e.g. New Year study plan promo"
                  className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                />
              </div>
              <ImagePicker
                purpose="banners"
                label={placement.key === 'header' ? 'Banner image (wide, e.g. 1600×300)' : 'Banner image (e.g. 1000×375)'}
                value={draft.imagePath}
                onChange={(url) =>
                  setDrafts((prev) => ({ ...prev, [placement.key]: { ...prev[placement.key], imagePath: url } }))
                }
              />
              <div>
                <label className="text-sm font-medium text-ink-700">Link URL (optional)</label>
                <input
                  value={draft.linkUrl}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [placement.key]: { ...prev[placement.key], linkUrl: e.target.value } }))
                  }
                  placeholder="/categories or https://..."
                  className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                />
              </div>
              <Button size="sm" onClick={() => addBanner(placement.key)} disabled={saving === placement.key}>
                {saving === placement.key ? 'Saving…' : 'Add banner'}
              </Button>
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function BannerStatsLine({ stats }: { stats: BannerStats | undefined }) {
  if (!stats || stats.impressionCount === 0) {
    return <p className="mt-1 text-xs text-ink-300">No views yet</p>;
  }
  return (
    <p className="mt-1 text-xs text-ink-400">
      {stats.impressionCount.toLocaleString()} view{stats.impressionCount === 1 ? '' : 's'} ·{' '}
      {stats.clickCount.toLocaleString()} click{stats.clickCount === 1 ? '' : 's'}
      {stats.ctrPercent !== null && ` · ${stats.ctrPercent.toFixed(2)}% CTR`}
    </p>
  );
}
