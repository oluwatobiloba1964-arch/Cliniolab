import { connection } from 'next/server';
import { siteSettingsService } from '@/lib/db';

/**
 * Server component. Reads the AdSense setting directly from the
 * database at request time and outputs the raw script tag into the
 * HTML response. This must NOT be a client component that fetches
 * config after mount: Google's site-verification crawler reads the
 * raw HTML and does not reliably wait for client-side JS to run, so a
 * client-fetched script tag would never be seen by it.
 *
 * connection() opts this component into request-time rendering. Without
 * it, Next tries to prerender pages like /_not-found at build time, where
 * no Cloudflare context (and no D1 binding) exists, and the build fails.
 * Keep it outside any try/catch, since it signals the bailout by throwing.
 *
 * This only controls the <head> verification/loader script. Whether
 * ad units actually render on a given page is a separate, path-based
 * decision made by AdSensePlacementGate.
 */
export async function AdSenseLoader() {
  await connection();

  const { enabled, clientId } = await siteSettingsService.getAdSenseSetting();
  if (!enabled || !clientId) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
    />
  );
}
