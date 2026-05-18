/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.svg', 'icon-512.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Nutrition Tracker',
        short_name: 'Nutrition',
        description: 'Lean bulk nutrition tracker for the 4-Day Blueprint',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'api.nal.usda.gov',
            handler: 'NetworkFirst',
            options: { cacheName: 'usda-api', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfoodfacts.org'),
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
