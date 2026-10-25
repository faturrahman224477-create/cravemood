/* CraveMood — service worker retired.
   The app now ships as a single self-contained index.html (no build assets to cache),
   so an old cache would only serve a stale version. This worker removes itself and
   all previous caches, then reloads open tabs once. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url).catch(() => {}));
    } catch (e) {}
  })());
});
