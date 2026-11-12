/* The Holy Bible — offline support.
   App shell: precached on install. Pages: network-first, falling back to the cache.
   Scripture and study data (data/): cache-first in their own cache, filled as books are read or when
   the reader keeps the whole Bible offline. Each file is kept under its own fingerprint, so an update
   replaces only the files that changed; everything else the reader has saved stays. */
const CACHE = 'holy-bible-__BUILD__';
const DATA = 'holy-bible-data';
const VERSIONS = /*__DATA_VERSIONS__*/ {};
const dataPath = (url) => {
  const i = url.pathname.indexOf('/data/');
  return i < 0 ? null : decodeURIComponent(url.pathname.slice(i + 6));
};
const dataKey = (url) => {
  const p = dataPath(url);
  return new URL(url.pathname + '?v=' + (VERSIONS[p] || '0'), url.origin).href;
};
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
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA).map((k) => caches.delete(k))))
      // drop only the saved data files whose fingerprint changed in this update
      .then(() => caches.open(DATA))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => r.url !== dataKey(new URL(r.url))).map((r) => c.delete(r)))))
      .then(() => self.clients.claim()),
  );
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
  if (url.pathname.includes('/data/')) {
    const key = dataKey(url);
    e.respondWith(
      caches.open(DATA).then((c) =>
        c.match(key).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) c.put(key, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((c) =>
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
