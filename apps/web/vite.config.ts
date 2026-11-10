import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

/**
 * The API is served from the same origin as the app, so the refresh cookie is
 * first-party and no CORS is needed. `changeOrigin: false` keeps the browser's
 * Host header, which the API's CSRF check compares with Origin.
 */
const api: Record<string, ProxyOptions> = {
  '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  // Lightning CSS handles CSS Modules (including composes from other files) without PostCSS.
  css: { transformer: 'lightningcss' },
  server: { port: 5173, strictPort: true, proxy: api },
  preview: { port: 4173, strictPort: true, proxy: api },
});
