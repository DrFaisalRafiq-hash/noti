// Noti service worker
// Minimal, no offline caching — only here to power web notifications
// (showNotification + click handling) and, in the future, web push.
//
// Icon hygiene: we explicitly *never* cache icon / manifest / splash
// assets, and we purge any that earlier SW versions may have stored.
// This way new iOS/Android installs always fetch the latest icon URLs.

const ICON_URL_PATTERN = /\/(icons\/|favicon\.|manifest\.webmanifest|noti-app-icon|apple-touch-icon)/i;

self.addEventListener("install", (event) => {
  // Activate immediately so notifications work on first load.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge any icon/manifest entries left behind by previous SW versions
      // or third-party caching layers, so the next request hits the network.
      try {
        if (self.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(
            keys.map(async (cacheName) => {
              const cache = await caches.open(cacheName);
              const requests = await cache.keys();
              await Promise.all(
                requests.map((req) =>
                  ICON_URL_PATTERN.test(new URL(req.url).pathname)
                    ? cache.delete(req)
                    : Promise.resolve(false),
                ),
              );
            }),
          );
        }
      } catch {
        /* cache purge is best-effort */
      }
      await self.clients.claim();
    })(),
  );
});

// Network-first, no-store for icon/manifest/splash assets.
// For everything else: pass through (SW does not cache app code).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (!ICON_URL_PATTERN.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        // Defensive: never let downstream caches store these.
        return fresh;
      } catch (err) {
        // Last-resort: try the default cache (browser HTTP cache) so the
        // home-screen icon still resolves when offline.
        const fallback = await fetch(req).catch(() => null);
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});

// Allow the app to schedule notifications by posting a message.
// Payload: { type: 'show', title, options }
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "show") {
    event.waitUntil(self.registration.showNotification(data.title, data.options || {}));
  }
});

// Web Push handler (used once server-side push is wired up).
self.addEventListener("push", (event) => {
  let payload = { title: "Noti", body: "You have a reminder", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  const strong = !!payload.strong;
  const priority = payload.priority || "normal";
  // Stronger alert pattern for Critical, lighter for High.
  const vibrate = strong
    ? priority === "critical"
      ? [300, 120, 300, 120, 300, 120, 600]
      : [200, 100, 200, 100, 400]
    : undefined;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url, noteId: payload.noteId, priority, strong },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      requireInteraction: strong, // keeps the alert on screen until tapped
      renotify: strong,           // re-alert even if same tag
      silent: false,
      vibrate,
    })
  );
});

// Tapping a notification opens the app and focuses any existing tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try {
            await c.focus();
            if ("navigate" in c) await c.navigate(targetUrl);
            return;
          } catch {}
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })()
  );
});
