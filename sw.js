// Ivrit Quest — service worker: cache everything, work fully offline
const CACHE = 'ivrit-quest-v16';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './stories.js',
  './stories-a.js',
  './stories-b.js',
  './stories-c.js',
  './stories-d.js',
  './app.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser HTTP cache so a new SW version
  // always installs fresh files (GitHub Pages serves with max-age=600)
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((res) => {
          if (!res.ok) throw new Error('fetch failed: ' + u);
          return c.put(u, res);
        })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    )
  );
});
