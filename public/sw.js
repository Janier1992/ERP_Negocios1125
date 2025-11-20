const CACHE_NAME = "mnp-cache-v4";
// Deriva la base dinámicamente del scope del Service Worker
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, "/");
// Algunos navegadores móviles inician fuera del scope. Aseguramos INDEX con BASE.
const INDEX = `${BASE}index.html`;
const SHELL = [INDEX, `${BASE}favicon.svg`, `${BASE}manifest.json`];

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
  const inScope = url.pathname.startsWith(BASE);

  // Navegación SPA: network-first con fallback a INDEX offline
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      // Network-first con timeout corto y fallback a INDEX offline
      const timeoutMs = 4000;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // Si la navegación está fuera de scope (móviles), redirige a BASE
        if (!inScope) {
          return Response.redirect(INDEX, 302);
        }
        const resp = await fetch(request, { signal: controller.signal });
        clearTimeout(id);
        return resp;
      } catch (e) {
        clearTimeout(id);
        const cached = await caches.match(INDEX);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Assets propios: cache-first (mejora rendimiento). No cachear APIs externas.
  if (sameOrigin && (url.pathname.startsWith(`${BASE}assets/`) || url.pathname === `${BASE}favicon.svg`)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) {
        // Stale-While-Revalidate: actualizar en segundo plano
        fetch(request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }).catch(() => {});
        return cached;
      }
      try {
        const resp = await fetch(request);
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return resp;
      } catch (e) {
        return Response.error();
      }
    })());
    return;
  }

  // Por defecto: pasar a red sin interferir (p.ej. Supabase, imágenes externas)
  event.respondWith(fetch(request));
});

// Mostrar notificaciones push cuando lleguen mensajes del servidor
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Notificación';
    const options = {
      body: data.body || '',
      icon: `${BASE}favicon.svg`,
      badge: `${BASE}favicon.svg`,
      data: data.data || {},
      actions: (data.actions || []),
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Si el payload no es JSON, intenta mostrar texto crudo
    const text = event.data ? event.data.text() : '';
    event.waitUntil(self.registration.showNotification('Notificación', { body: text }));
  }
});

// Manejar clics en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ((client as any).url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});