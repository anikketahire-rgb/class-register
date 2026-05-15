// Class Register Service Worker v2
// Strategy:
//   - HTML/index: network-first (always pull latest when online; fall back to cache if offline)
//   - Static assets (icons, manifest): cache-first (they rarely change)
//   - Cache version: bump to force old caches to clear
//
// When you update the app, also increment CACHE_NAME (e.g. v3, v4...) — this guarantees a clean refresh.

const CACHE_NAME = 'class-register-v4-2026-05-15';

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some static assets failed to cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Helper: is this an HTML/navigation request?
function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  if (url.pathname.endsWith('.html')) return true;
  if (url.pathname.endsWith('/')) return true; // root path
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // STRATEGY 1: Network-first for HTML/navigation (so updates appear when online)
  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Got a fresh response — cache it for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — fall back to cache
          return caches.match(event.request).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // STRATEGY 2: Cache-first for static assets (icons, manifest)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Listen for update messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});
