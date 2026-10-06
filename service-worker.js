const CACHE_NAME = "course-library-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./config.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./services/legacy-catalog.js",
  "./services/library.js",
  "./services/supabase.js",
  "./admin/login.html",
  "./admin/login.js",
  "./admin/dashboard.html",
  "./admin/dashboard.js",
  "./admin/admin.css",
];
const APP_ASSETS = new Set(
  APP_SHELL.map((path) => new URL(path, self.registration.scope).href),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        APP_SHELL.map((path) => new Request(path, { cache: "reload" })),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("course-library-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  if (
    request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    !APP_ASSETS.has(requestUrl.href)
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "مكتبة المقررات", {
      body: payload.body || "يوجد تحديث جديد في المكتبة.",
      icon: new URL("./app-icon-192.png", self.registration.scope).href,
      badge: new URL("./favicon.svg", self.registration.scope).href,
      image: typeof payload.image === "string" ? payload.image : undefined,
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: payload.url || self.registration.scope },
      tag: payload.id || "course-library-update",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || self.registration.scope,
    self.registration.scope,
  );
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients.find((client) => {
          const current = new URL(client.url);
          return current.origin === target.origin &&
            current.pathname.startsWith(new URL(self.registration.scope).pathname);
        });
        if (existing) {
          await existing.navigate(target.href);
          return existing.focus();
        }
        return self.clients.openWindow(target.href);
      }),
  );
});
