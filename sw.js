// Nebula Touch — service worker
// Caches the app shell (HTML/manifest/icons/three.js) so the app opens and
// runs fully offline. Anything else (user-picked audio URLs, etc.) is left
// to the network untouched — we never want to cache someone's music files
// or silently serve a stale copy of a remote audio stream.

const CACHE_VERSION = 'nebula-touch-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon-16.png',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isAppShellRequest(url) {
  // Same-origin requests to the app's own files, or the pinned three.js CDN url.
  if (url.origin === self.location.origin) return true;
  if (url.href === 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (!isAppShellRequest(url)) {
    // Audio tracks, other remote resources: go straight to network,
    // don't intercept or cache. Let the page's own error handling
    // (e.g. "that file is missing") do its job if it fails.
    return;
  }

  // App shell: cache-first, falling back to network, and topping up
  // the cache in the background so updates eventually take effect.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
