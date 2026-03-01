const CACHE = 'myshopuz-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  const url = new URL(e.request.url);
  // Skip SW in development to avoid breaking hot reload and chunk loading
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return;
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/catalog')) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(e.request)
          .then((r) => {
            if (r.ok) cache.put(e.request, r.clone());
            return r;
          })
          .catch(() => cache.match(e.request))
          .then((response) => response !== undefined ? response : fetch(e.request))
      )
    );
  }
});
