const CACHE_VERSION = "rift-tavern-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-72.png",
  "./icon-96.png",
  "./icon-128.png",
  "./icon-144.png",
  "./icon-152.png",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-384.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigations: try network first (fresh content), fall back to cached app shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin assets: cache-first, then network, and cache what we fetch.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Cross-origin (Google Fonts, etc): stale-while-revalidate so the game still
  // renders offline once fonts have been fetched once.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
