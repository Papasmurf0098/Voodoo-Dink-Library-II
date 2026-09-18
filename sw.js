const PREFIX = `voodoo-library:${self.registration.scope}:`;
const CACHE = `${PREFIX}2026-09-18-v6`;
const REQUIRED = ['./', './index.html', './styles.css', './js/app.js', './js/catalog.js', './js/storage.js', './js/route.js', './js/data.js', './js/pairing-guidance.js', './data/drinks.json', './manifest.webmanifest', './assets/icons/voodoo.svg', './assets/icons/voodoo-180.png', './assets/icons/voodoo-192.png', './assets/icons/voodoo-512.png'];
const OPTIONAL = ['./data/food.json', './ASSET_CREDITS.md', './RESEARCH_AUDIT.md', './assets/whiskey-rocks.jpg', './assets/citrus-cocktail.jpg', './assets/wine-service.jpg'];
const ASSET_PATHS = new Set([...REQUIRED, ...OPTIONAL].map((path) => new URL(path, self.registration.scope).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(REQUIRED);
    // A missing menu or photo must not prevent the drink library working offline.
    await Promise.allSettled(OPTIONAL.map((path) => cache.add(path)));
    await self.skipWaiting();
  })());
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
  const cacheKey = new URL(url.pathname, url.origin).href;
  event.respondWith((async () => {
    let cache;
    let cached;
    try { cache = await caches.open(CACHE); cached = await cache.match(cacheKey); } catch { /* Network still works when caching is unavailable. */ }
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Network timeout')); }, cached ? 3500 : 10000);
    });
    try {
      const response = await Promise.race([fetch(event.request, { signal: controller.signal }), timeout]);
      if (cached && (response.status >= 500 || response.status === 429)) return cached;
      if (response.ok && cache) await cache.put(cacheKey, response.clone()).catch(() => {});
      return response;
    } catch {
      return cached || new Response('This resource is not available offline. Reconnect and reload.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } finally { clearTimeout(timer); }
  })());
});
