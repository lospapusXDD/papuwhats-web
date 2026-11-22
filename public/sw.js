const CACHE_NAME = 'papuwhats-cache-v1';
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.startsWith('chrome-extension')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
