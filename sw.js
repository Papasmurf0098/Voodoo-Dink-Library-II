const PREFIX = `voodoo-library:${self.registration.scope}:`;
const CACHE = `${PREFIX}2026-09-07-v4`;
const SHELL = ['./', './index.html', './styles.css', './js/app.js', './js/catalog.js', './js/route.js', './js/storage.js', './data/drinks.json', './data/food.json', './manifest.webmanifest', './ASSET_CREDITS.md', './assets/whiskey-rocks.jpg', './assets/citrus-cocktail.jpg', './assets/wine-service.jpg'];
const ASSET_PATHS = new Set(SHELL.map((path) => new URL(path, self.registration.scope).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSET_PATHS.has(url.pathname)) return;
  // Query strings hold local filter/profile state, not separate server documents.
  const cacheKey = new URL(url.pathname, url.origin).href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(cacheKey, response.clone()).catch(() => {});
      return response;
    } catch {
      return await cache.match(cacheKey)
        || new Response('This resource is not available offline. Reconnect and reload.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
