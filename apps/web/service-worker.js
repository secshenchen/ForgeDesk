/* The build prepends CACHE_REVISION and APP_FILES from the generated bundle. */
const scope = self.registration.scope;
const prefix = 'forgedesk:' + scope + ':';
const cacheName = prefix + CACHE_REVISION;
const index = new URL('./index.html', scope).href;
const assets = new Set(APP_FILES.map(file => new URL(file, scope).href));

self.addEventListener('install', event => {
  const requests = [...assets].map(url => new Request(url, { cache: 'reload', redirect: 'error' }));
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const key = request.mode === 'navigate' && request.url === scope ? index : request.url;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(key)) ?? fetch(request);
  })());
});
