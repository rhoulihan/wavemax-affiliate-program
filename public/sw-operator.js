// Service Worker for Operator Scanner PWA
const CACHE_NAME = 'operator-scanner-v1';
const urlsToCache = [
  '/operator-scan-embed.html',
  '/assets/css/operator-scan-embed.css',
  '/assets/css/operator-scan.css',
  '/assets/js/operator-scan-init.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});