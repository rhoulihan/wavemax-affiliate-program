// Minimal service worker for the /scanbag PWA. It exists so the page is
// installable (Chrome requires a registered SW with a fetch handler before it
// will fire beforeinstallprompt). It does NOT cache — the scanner always needs
// a live network for the bag-claim redirect; offline gets a clear 503.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => new Response('Offline — reconnect to scan a bag.', {
      status: 503, headers: { 'Content-Type': 'text/plain' }
    }))
  );
});
