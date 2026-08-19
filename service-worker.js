// Nebula Touch — service worker
// Only caches the app shell (this HTML/JS/CSS file, manifest, icons) so the
// visualizer opens instantly and works offline. Audio — local files (via
// IndexedDB/blob URLs), and remote tracks (e.g. raw.githubusercontent.com) —
// is deliberately left untouched: those requests are cross-origin or blob:
// URLs, and we never want the SW's caching layer sitting between the
// <audio> element and its source (that can break byte-range seeking).

const CACHE_NAME = 'nebula-touch-v1';

const APP_SHELL = [
  './',
  './Index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Leave everything except same-origin GETs completely alone — that
  // covers audio streaming, range requests, and any cross-origin fetches.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
