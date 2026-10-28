import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app ("Thêm vào MH chính" on iPhone) that works offline: the app shell and all study data are precached.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vocab – Học tiếng Anh',
        short_name: 'Vocab',
        lang: 'vi',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f4efe4',
        theme_color: '#f4efe4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // words.json is ~1.6 MB
        // Pronunciation audio from dictionaryapi.dev: keep what was played so it works offline later.
        runtimeCaching: [{
          urlPattern: /^https:\/\/api\.dictionaryapi\.dev\//,
          handler: 'CacheFirst',
          options: { cacheName: 'dictionary', expiration: { maxEntries: 3000 } },
        }],
      },
    }),
  ],
  // Relative base so the build works on any static host path (GitHub Pages, Vercel, Netlify).
  base: './',
})
