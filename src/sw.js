const config =
  /* build injects a content fingerprint and exact resource list */ __BUILD_CONFIG__;
const cacheName = "pixel-days-" + config.version;
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(config.resources)),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("pixel-days-") && key !== cacheName)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data === "APPLY_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName),
        hit = await cache.match(event.request);
      if (hit) return hit;
      return fetch(event.request);
    })(),
  );
});
