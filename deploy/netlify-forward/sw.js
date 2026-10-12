// Replaces the offline app that used to live on this address. It clears the old
// caches, removes itself, and reloads each open page, which the 301 rule then
// sends to the new site.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(pages.map((page) => page.navigate(page.url)));
    })(),
  );
});
