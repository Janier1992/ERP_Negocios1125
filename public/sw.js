const CACHE_NAME = "mnp-cache-v2";
const BASE = "/MiNegocioPymes/";
const INDEX = `${BASE}index.html`;
const SHELL = [INDEX, `${BASE}favicon.svg`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navegación SPA: network-first con fallback a INDEX offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(INDEX))
    );
    return;
  }

  // Assets propios: cache-first (mejora rendimiento). No cachear APIs externas.
  if (sameOrigin && (url.pathname.startsWith(`${BASE}assets/`) || url.pathname === `${BASE}favicon.svg`)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // Por defecto: pasar a red sin interferir (p.ej. Supabase, imágenes externas)
  event.respondWith(fetch(request));
});