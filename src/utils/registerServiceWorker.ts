const SERVICE_WORKER_URL = "/sw.js";

export interface RegisterServiceWorkerOptions {
  /** Override environment check (defaults to `import.meta.env.PROD && !import.meta.env.VITEST`). */
  isProd?: boolean;
  /** Override the service worker script URL (defaults to `/sw.js`). */
  scriptUrl?: string;
}

/**
 * Registers the application service worker in production builds after window load.
 * Silently no-ops in dev/test environments, unsupported browsers, or on registration failure.
 */
export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}): void {
  const isProd =
    options.isProd ?? (Boolean(import.meta.env.PROD) && !Boolean(import.meta.env.VITEST));
  if (!isProd) {
    return;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  if (!("serviceWorker" in navigator) || !navigator.serviceWorker) {
    return;
  }

  const scriptUrl = options.scriptUrl ?? SERVICE_WORKER_URL;

  const doRegister = () => {
    try {
      const registrationPromise = navigator.serviceWorker.register(scriptUrl, { scope: "/" });
      if (registrationPromise && typeof registrationPromise.catch === "function") {
        void registrationPromise.catch(() => {
          /* Failed registration must never break the app */
        });
      }
    } catch {
      /* Ignore synchronous registration errors */
    }
  };

  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}

/**
 * Instructs the active service worker to drop cached catalogue API responses.
 * Called when switching or removing an account so cached responses are never leaked across accounts.
 */
export function clearServiceWorkerApiCache(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !navigator.serviceWorker) {
    return;
  }

  const message = { type: "CLEAR_API_CACHE" };

  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
      return;
    }

    if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === "function") {
      void navigator.serviceWorker.ready
        .then((registration) => {
          registration.active?.postMessage(message);
        })
        .catch(() => {
          /* Ignore errors when no service worker is active */
        });
    }
  } catch {
    /* Ignore postMessage failures */
  }
}
