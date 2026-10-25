import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const devPort = Number(process.env.FRONTEND_PORT ?? 5173);
const devHost = process.env.CARETO_DEV_HOST;
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT ?? devPort);

const version = process.env.VITE_APP_VERSION ?? 'dev';
const buildId = `${version}+${new Date().toISOString()}`;

const appVersionStampPlugin: Plugin = {
  name: 'careto-app-version-stamp',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'app-version.json',
      source: JSON.stringify({ version, buildId }),
    });
  },
};

export default defineConfig({
  plugins: [
    appVersionStampPlugin,
    vue(),
    VitePWA({
      // ADR-0020: injectManifest (a hand-written service worker with
      // Workbox precaching injected in) instead of generateSW, because a
      // push/notificationclick handler needs a custom worker file — see
      // src/sw.ts. Precaching, cleanup, and the /api/ navigation denylist
      // (previously `workbox.navigateFallbackDenylist` below) all had to be
      // re-implemented by hand there; see that file for the equivalent.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // vite-plugin-pwa's injectManifest build runs its own esbuild pass
        // over src/sw.ts; it does not go through the app's own Vite/Vitest
        // pipeline, so this glob only needs to match what sw.ts precaches.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      includeAssets: [
        'careto.svg',
        'logo-192.png',
        'logo-512.png',
      ],
      manifest: {
        name: 'Careto',
        short_name: 'Careto',
        description: 'Your shopping list, filled in for you',
        theme_color: '#13121B',
        background_color: '#13121B',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  server: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: true,
    hmr: devHost
      ? {
          host: devHost,
          clientPort: hmrClientPort,
          protocol: 'ws',
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
