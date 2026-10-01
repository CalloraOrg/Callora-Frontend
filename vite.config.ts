import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev-server proxy target is configurable through the environment so a
 * developer can point `/api` at a remote backend without editing this file.
 * `loadEnv` also picks up matching `VITE_*` values from the real shell, which
 * is what makes `VITE_DEV_API_PROXY_TARGET=... npm run dev` work.
 *
 * Only the dev server reads this: the browser bundle always calls relative
 * `/api/...` paths unless `VITE_API_BASE_URL` is set. See
 * `docs/Configuration.md` and `.env.example`.
 */
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const apiProxyTarget =
    env.VITE_DEV_API_PROXY_TARGET?.trim() || DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
