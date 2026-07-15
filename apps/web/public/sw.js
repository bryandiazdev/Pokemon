/* Pokémon Stock Radar service worker — offline shell + safe caching.
 * IMPORTANT: never cache authenticated API responses or private images. Only the
 * static app shell and public assets are cached. Private data is network-only. */
const CACHE = 'psr-shell-v1';
const SHELL = ['/', '/offline', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API calls or anything that could contain private data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/app/')) {
    event.respondWith(
      fetch(request).catch(() =>
        url.pathname.startsWith('/app/') ? caches.match('/offline') : Response.error(),
      ),
    );
    return;
  }

  // Static/public: cache-first with network fallback.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            if (res.ok && url.origin === self.location.origin) {
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => caches.match('/offline')),
    ),
  );
});
