const SHELL_CACHE = "callora-shell-v1";
const CATALOG_CACHE = "callora-catalog-v1";
const CURRENT_CACHES = [SHELL_CACHE, CATALOG_CACHE];
const SHELL_PRECACHE_URLS = ["/", "/index.html"];

function isCatalogApiPath(pathname) {
  return pathname === "/api/apis" || pathname.startsWith("/api/apis/");
}

function isStaticAssetPath(pathname) {
  return pathname.startsWith("/assets/");
}

function isShellPath(pathname) {
  return pathname === "/" || pathname === "/index.html";
}

function hasAuthorizationHeader(request) {
  return Boolean(request.headers && typeof request.headers.has === "function" && request.headers.has("Authorization"));
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      if (cached) {
        return cached;
      }
      throw error;
    });

  if (cached) {
    if (event && typeof event.waitUntil === "function") {
      event.waitUntil(networkPromise.catch(() => {}));
    }
    return cached;
  }

  return networkPromise;
}

async function handleNavigationRequest(request, event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = (await cache.match(request)) || (await cache.match("/index.html")) || (await cache.match("/"));

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put("/index.html", response.clone());
      }
      return response;
    })
    .catch((error) => {
      if (cached) {
        return cached;
      }
      throw error;
    });

  if (cached) {
    if (event && typeof event.waitUntil === "function") {
      event.waitUntil(networkPromise.catch(() => {}));
    }
    return cached;
  }

  return networkPromise;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event && event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "CLEAR_API_CACHE") {
    const clearPromise = caches.delete(CATALOG_CACHE);
    if (typeof event.waitUntil === "function") {
      event.waitUntil(clearPromise);
    }
  } else if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") {
    return;
  }

  if (hasAuthorizationHeader(request)) {
    return;
  }

  const url = new URL(request.url, self.location.origin);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (isCatalogApiPath(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, CATALOG_CACHE, event));
    }
    return;
  }

  if (isStaticAssetPath(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, event));
    return;
  }

  if (request.mode === "navigate" || isShellPath(url.pathname)) {
    event.respondWith(handleNavigationRequest(request, event));
  }
});
