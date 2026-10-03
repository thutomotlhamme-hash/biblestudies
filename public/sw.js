/* The Holy Bible — offline support.
   App shell: precached on install. Pages: network-first, falling back to the cache.
   Scripture and study data (data/): cache-first in their own cache, kept across app updates while
   the data is unchanged, filled as books are read or when the reader keeps the whole Bible offline. */
const CACHE = 'holy-bible-__BUILD__';
const DATA = 'holy-bible-data-__DATA__';
const PRECACHE = /*__PRECACHE__*/ ['./', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./'))),
    );
    return;
  }
  const isData = url.pathname.includes('/data/');
  const bucket = isData ? DATA : CACHE;
  e.respondWith(
    caches.open(bucket).then((c) =>
      c.match(req, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          }),
      ),
    ),
  );
});
