const CACHE_NAME = "tower-lighting-app-v28";
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./bluetooth.js",
  "./building.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./vendor/three.module.js",
  "./vendor/gsap/index.js",
  "./vendor/gsap/gsap-core.js",
  "./vendor/gsap/CSSPlugin.js",
  "./vendor/THREE-LICENSE",
  "./vendor/GSAP-NOTICE.txt",
];
const APP_FILE_URLS = new Set(APP_FILES.map((file) => new URL(file, self.registration.scope).href));
const OFFLINE_URL = new URL("./offline.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES.map((file) => new Request(new URL(file, self.registration.scope)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("towerlighting-shell-") || key.startsWith("tower-lighting-app-"))
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cachedPage = await caches.match(request)
        ?? await caches.match(new URL("./index.html", self.registration.scope).href);
      if (cachedPage) return cachedPage;

      try {
        return await fetch(request);
      } catch {
        const offlinePage = await caches.match(OFFLINE_URL);
        return offlinePage ?? new Response("Tower Lighting is offline. Reconnect once to save the app for offline use.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  if (!APP_FILE_URLS.has(requestUrl.href)) return;

  event.respondWith((async () => {
    const cachedFile = await caches.match(request);
    if (cachedFile) return cachedFile;

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      throw new Error(`Tower Lighting could not load ${requestUrl.pathname} while offline.`);
    }
  })());
});
