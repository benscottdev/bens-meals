// Ben's Meals service worker: push notifications + offline shopping list / recipes.
const CACHE = "bens-meals-v2";
const DEV = location.hostname === "localhost" || location.hostname.endsWith(".localhost") || location.hostname === "127.0.0.1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => DEV || k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for pages (so the list is fresh), falling back to the last copy when offline in the shop.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (DEV) return; // never cache while developing — stale chunks break hot reload
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }
  if (req.mode === "navigate" || req.headers.get("RSC")) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/shop"))),
    );
  }
});

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : { title: "Ben's Meals" };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/plan" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/plan";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
