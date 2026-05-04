import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA setup: a manifest + service worker that caches the app shell so it
// installs cleanly on Android Chrome (Add to Home Screen). The dev SW is
// disabled — it would race with HMR. The prod SW uses Workbox's defaults
// (precache the build output, network-first for cross-origin API calls).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we ship the manifest manually at public/manifest.webmanifest
      includeAssets: ['logo.svg', 'manifest.webmanifest'],
      devOptions: { enabled: false },
      workbox: {
        // Don't precache the manifest itself — it's served fresh.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/],
        // Firebase + Cloud Functions calls are network-only by intent.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.cloudfunctions\.net\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.run\.app\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
