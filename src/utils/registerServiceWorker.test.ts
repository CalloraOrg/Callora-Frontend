import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearServiceWorkerApiCache, registerServiceWorker } from "./registerServiceWorker";
import { invalidateAccountCache } from "./offlineApiCache";

function setNavigatorServiceWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value,
  });
}

describe("registerServiceWorker", () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  const originalReadyState = Object.getOwnPropertyDescriptor(document, "readyState");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    if (originalReadyState) {
      Object.defineProperty(document, "readyState", originalReadyState);
    }
  });

  it("skips registration in dev and Vitest environments by default", () => {
    const register = vi.fn().mockResolvedValue({});
    setNavigatorServiceWorker({ register });

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });

  it("ignores unsupported browsers without serviceWorker", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");

    expect(() => registerServiceWorker({ isProd: true })).not.toThrow();
  });

  it("registers /sw.js after load in production builds", () => {
    const register = vi.fn().mockResolvedValue({});
    setNavigatorServiceWorker({ register });
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading",
    });

    registerServiceWorker({ isProd: true });
    expect(register).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("registers immediately when document is already complete", () => {
    const register = vi.fn().mockResolvedValue({});
    setNavigatorServiceWorker({ register });
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });

    registerServiceWorker({ isProd: true });
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("does not throw when registration rejects", async () => {
    const register = vi.fn().mockRejectedValue(new Error("SW registration failed"));
    setNavigatorServiceWorker({ register });
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });

    expect(() => registerServiceWorker({ isProd: true })).not.toThrow();
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("posts CLEAR_API_CACHE to the active controller", () => {
    const postMessage = vi.fn();
    setNavigatorServiceWorker({
      controller: { postMessage },
    });

    clearServiceWorkerApiCache();

    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_API_CACHE" });
  });

  it("posts CLEAR_API_CACHE via ready registration when controller is null", async () => {
    const postMessage = vi.fn();
    setNavigatorServiceWorker({
      controller: null,
      ready: Promise.resolve({ active: { postMessage } }),
    });

    clearServiceWorkerApiCache();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_API_CACHE" });
  });

  it("posts CLEAR_API_CACHE when invalidateAccountCache is called", () => {
    const postMessage = vi.fn();
    setNavigatorServiceWorker({
      controller: { postMessage },
    });

    invalidateAccountCache("account-1");

    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_API_CACHE" });
  });
});

interface FakeResponse {
  ok: boolean;
  status: number;
  body: string;
  clone: () => FakeResponse;
}

function createFakeResponse(body: string, status = 200): FakeResponse {
  const res: FakeResponse = {
    ok: status >= 200 && status < 300,
    status,
    body,
    clone: () => createFakeResponse(body, status),
  };
  return res;
}

interface FakeRequest {
  url: string;
  method: string;
  mode?: string;
  headers: Headers;
}

function createFakeRequest(
  url: string,
  init: { method?: string; mode?: string; headers?: Record<string, string> } = {}
): FakeRequest {
  return {
    url,
    method: init.method ?? "GET",
    mode: init.mode,
    headers: new Headers(init.headers),
  };
}

function loadServiceWorkerHarness() {
  const swPath = path.resolve(process.cwd(), "public/sw.js");
  const swSource = fs.readFileSync(swPath, "utf8");

  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const store = new Map<string, Map<string, FakeResponse>>();

  const getCacheBucket = (name: string) => {
    let bucket = store.get(name);
    if (!bucket) {
      bucket = new Map<string, FakeResponse>();
      store.set(name, bucket);
    }
    return bucket;
  };

  const toKey = (req: string | FakeRequest) => (typeof req === "string" ? req : req.url);

  const fakeCaches = {
    open: vi.fn(async (name: string) => {
      const bucket = getCacheBucket(name);
      return {
        addAll: vi.fn(async (urls: string[]) => {
          for (const url of urls) {
            bucket.set(url, createFakeResponse(`precached:${url}`));
          }
        }),
        match: vi.fn(async (req: string | FakeRequest) => bucket.get(toKey(req))),
        put: vi.fn(async (req: string | FakeRequest, res: FakeResponse) => {
          bucket.set(toKey(req), res);
        }),
      };
    }),
    keys: vi.fn(async () => Array.from(store.keys())),
    delete: vi.fn(async (name: string) => store.delete(name)),
  };

  const fakeFetch = vi.fn<(req: FakeRequest) => Promise<FakeResponse>>();

  const fakeSelf = {
    location: { origin: "https://callora.example" },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
    },
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      const existing = listeners.get(type) ?? [];
      existing.push(handler);
      listeners.set(type, existing);
    }),
  };

  const runWorker = new Function("self", "caches", "fetch", swSource);
  runWorker(fakeSelf, fakeCaches, fakeFetch);

  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    const handlers = listeners.get(type) ?? [];
    const waitUntilPromises: Array<Promise<unknown>> = [];
    let respondedWith: Promise<FakeResponse> | null = null;

    const fullEvent = {
      ...event,
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromises.push(promise);
      },
      respondWith: (promise: Promise<FakeResponse>) => {
        respondedWith = promise;
      },
    };

    for (const handler of handlers) {
      handler(fullEvent);
    }

    return {
      respondedWith,
      waitUntil: () => Promise.all(waitUntilPromises),
    };
  };

  return { store, fakeCaches, fakeFetch, fakeSelf, dispatch };
}

describe("public/sw.js", () => {
  it("precaches shell routes on install and skips waiting", async () => {
    const { store, fakeSelf, dispatch } = loadServiceWorkerHarness();

    const { waitUntil } = await dispatch("install");
    await waitUntil();

    expect(store.get("callora-shell-v1")?.has("/")).toBe(true);
    expect(store.get("callora-shell-v1")?.has("/index.html")).toBe(true);
    expect(fakeSelf.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("deletes old cache versions on activate and claims clients", async () => {
    const { store, fakeSelf, dispatch } = loadServiceWorkerHarness();
    store.set("callora-shell-v0", new Map());
    store.set("callora-catalog-v0", new Map());
    store.set("callora-shell-v1", new Map());
    store.set("callora-catalog-v1", new Map());

    const { waitUntil } = await dispatch("activate");
    await waitUntil();

    expect(store.has("callora-shell-v0")).toBe(false);
    expect(store.has("callora-catalog-v0")).toBe(false);
    expect(store.has("callora-shell-v1")).toBe(true);
    expect(store.has("callora-catalog-v1")).toBe(true);
    expect(fakeSelf.clients.claim).toHaveBeenCalledTimes(1);
  });

  it("serves catalogue SWR hit immediately and revalidates in the background", async () => {
    const { store, fakeFetch, dispatch } = loadServiceWorkerHarness();
    const url = "https://callora.example/api/apis";
    store.set("callora-catalog-v1", new Map([[url, createFakeResponse("stale-catalog")]]));
    fakeFetch.mockResolvedValue(createFakeResponse("fresh-catalog"));

    const { respondedWith, waitUntil } = await dispatch("fetch", {
      request: createFakeRequest(url),
    });

    expect(respondedWith).not.toBeNull();
    const response = await respondedWith!;
    expect(response.body).toBe("stale-catalog");

    await waitUntil();
    expect(store.get("callora-catalog-v1")?.get(url)?.body).toBe("fresh-catalog");
  });

  it("fetches and caches catalogue response on SWR miss", async () => {
    const { store, fakeFetch, dispatch } = loadServiceWorkerHarness();
    const url = "https://callora.example/api/apis?category=finance";
    fakeFetch.mockResolvedValue(createFakeResponse("network-catalog"));

    const { respondedWith } = await dispatch("fetch", {
      request: createFakeRequest(url),
    });

    expect(respondedWith).not.toBeNull();
    const response = await respondedWith!;
    expect(response.body).toBe("network-catalog");
    expect(store.get("callora-catalog-v1")?.get(url)?.body).toBe("network-catalog");
  });

  it("serves cached catalogue when offline and rejects on uncached network failure", async () => {
    const { store, fakeFetch, dispatch } = loadServiceWorkerHarness();
    const cachedUrl = "https://callora.example/api/apis";
    store.set("callora-catalog-v1", new Map([[cachedUrl, createFakeResponse("offline-catalog")]]));
    fakeFetch.mockRejectedValue(new Error("offline"));

    const hitResult = await dispatch("fetch", {
      request: createFakeRequest(cachedUrl),
    });
    expect((await hitResult.respondedWith!)?.body).toBe("offline-catalog");
    await expect(hitResult.waitUntil()).resolves.toBeDefined();

    const missResult = await dispatch("fetch", {
      request: createFakeRequest("https://callora.example/api/apis/missing"),
    });
    await expect(missResult.respondedWith!).rejects.toThrow("offline");
  });

  it("uses SWR on callora-shell-v1 for same-origin /assets/* requests", async () => {
    const { store, fakeFetch, dispatch } = loadServiceWorkerHarness();
    const assetUrl = "https://callora.example/assets/index-abc123.js";
    fakeFetch.mockResolvedValue(createFakeResponse("console.log('app')"));

    const { respondedWith } = await dispatch("fetch", {
      request: createFakeRequest(assetUrl),
    });

    expect(respondedWith).not.toBeNull();
    const response = await respondedWith!;
    expect(response.body).toBe("console.log('app')");
    expect(store.get("callora-shell-v1")?.get(assetUrl)?.body).toBe("console.log('app')");
  });

  it("bypasses non-GET, Authorization-bearing, and non-catalogue /api/* requests", async () => {
    const { dispatch } = loadServiceWorkerHarness();

    const postResult = await dispatch("fetch", {
      request: createFakeRequest("https://callora.example/api/apis", { method: "POST" }),
    });
    expect(postResult.respondedWith).toBeNull();

    const authResult = await dispatch("fetch", {
      request: createFakeRequest("https://callora.example/api/apis", {
        headers: { Authorization: "Bearer secret-token" },
      }),
    });
    expect(authResult.respondedWith).toBeNull();

    const otherApiResult = await dispatch("fetch", {
      request: createFakeRequest("https://callora.example/api/account/profile"),
    });
    expect(otherApiResult.respondedWith).toBeNull();
  });

  it("clears callora-catalog-v1 on CLEAR_API_CACHE message", async () => {
    const { store, dispatch } = loadServiceWorkerHarness();
    store.set("callora-catalog-v1", new Map([["/api/apis", createFakeResponse("cached")]]));
    store.set("callora-shell-v1", new Map([["/", createFakeResponse("shell")]]));

    const { waitUntil } = await dispatch("message", {
      data: { type: "CLEAR_API_CACHE" },
    });
    await waitUntil();

    expect(store.has("callora-catalog-v1")).toBe(false);
    expect(store.has("callora-shell-v1")).toBe(true);
  });
});
