// Piper service worker
// - Pages: always try the network first, so new deployments show up right away.
// - Built files in /assets/ have unique names, so they are cached and served instantly.
// - Everything else (icons, logo, manifest): network first, cache as a fallback.
// - A missing file can never block an update.
const CACHE = 'piper-v20261116-1';
const SHELL = ['/Piper/', '/Piper/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/Piper/')) return;

  // Page loads: network first, fall back to the saved copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE).then(cache => cache.put('/Piper/index.html', copy)).catch(() => {});
        }
        return fresh;
      } catch {
        return (await caches.match('/Piper/index.html')) || (await caches.match('/Piper/')) || Response.error();
      }
    })());
    return;
  }

  // Built app files have unique names: cache first.
  if (url.pathname.startsWith('/Piper/assets/') && /-[A-Za-z0-9_-]{6,}\./.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }))
    );
    return;
  }

  // Everything else: network first, cache as backup.
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then(hit => hit || Response.error()))
  );
});
