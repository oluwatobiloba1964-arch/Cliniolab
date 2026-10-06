// Cliniolab service worker.
// Responsibilities: (1) cache the app shell + static assets (CSS/JS/fonts/
// icons) so the site never renders unstyled or breaks offline or on flaky
// connections, (2) offline fallback for page navigations, (3) push
// notification display.

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `cliniolab-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `cliniolab-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/';
// Routes that must work with no network. /offline is where saved quizzes and
// flashcards live, so it is precached and used as the offline fallback for
// any navigation to that route.
const OFFLINE_ROUTE = '/offline';
const PRECACHE_URLS = [OFFLINE_URL, OFFLINE_ROUTE];

const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // allSettled-style: one failed precache must not block install.
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Static build assets - Next.js content-hashes these filenames, so once a
// given URL is cached it can never go stale under a different deploy; safe
// to serve cache-first and only hit the network on a cache miss.
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/image') ||
      /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API/data requests - quiz/exam content, auth state, etc.
  // must always be fresh and must never be served stale from cache.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: network-first so users always get the latest page
  // when online, falling back to the cached shell when offline. Also
  // opportunistically updates the shell cache on every successful load.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache each successful navigation under its own path, so any
          // page the user has visited is available offline. The /offline
          // route and the homepage are also refreshed by the precache.
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              // Only fall back to the offline route for the offline route itself;
              // other unknown pages fall back to the homepage shell.
              (url.pathname === OFFLINE_ROUTE
                ? caches.match(OFFLINE_ROUTE)
                : caches.match(OFFLINE_URL))
          )
        )
    );
    return;
  }

  // Static assets (CSS, JS chunks, fonts, icons): cache-first, so the app
  // is fully styled and functional offline and on slow/flaky connections,
  // not just able to load a bare HTML shell.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
});

// Push notifications (e.g. comment replies, quiz result follow-ups,
// new blog posts). The push payload is expected to be JSON:
// { title, body, url, tag?, image? }. `image` is a large banner-style
// hero image shown inline in the notification body — supported on
// Android Chrome, harmlessly ignored where it isn't (e.g. iOS Safari).
// FIX (silent/suppressed push) — public/sw.js
// Chrome enforces the push/notification contract strictly: every `push`
// event MUST result in a call to showNotification() before the event's
// lifetime ends, or the browser treats it as a "silent push". A handful
// of silent pushes in a row and Chrome starts showing the user a forced
// "site has been updated in the background" notification on your behalf,
// and can mute future pushes from this origin entirely. The old handler
// violated this in two ways: (1) it returned early with no notification
// at all when event.data was missing, and (2) showNotification() was
// fire-and-forgot — not actually guaranteed to resolve before the event
// handler's promise settled, and no fallback fired if it rejected (e.g.
// a bad icon/image URL, which Chrome treats as a failure to show).
// Now: always await a notification, with a generic fallback on missing
// data, and a last-resort fallback that strips the option that triggered
// a failure and retries once rather than letting the event finish silent.
self.addEventListener('push', (event) => {
  let payload = { title: 'Cliniolab', body: 'You have a new notification.', url: '/' };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag,
    data: { url: payload.url },
  };
  if (payload.image) options.image = payload.image;

  event.waitUntil(
    self.registration.showNotification(payload.title, options).catch(() => {
      // Most likely cause of a rejected showNotification: the `image`
      // URL (large banner image) failed to load/decode. Retry once
      // without it instead of leaving this push silent.
      const { image, ...safeOptions } = options;
      return self.registration.showNotification(payload.title, safeOptions);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
