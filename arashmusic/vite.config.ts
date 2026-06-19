import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "arashmusic",
        short_name: "arashmusic",
        description: "A personal music library player",
        theme_color: "#0b0a0c",
        background_color: "#0b0a0c",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallbackDenylist: [/^\/rest\//],
        runtimeCaching: [
          {
            urlPattern: /\/rest\/getCoverArt/,
            handler: "CacheFirst",
            options: {
              cacheName: "arashmusic-art",
              expiration: { maxEntries: 500, maxAgeSeconds: 2592000 }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/rest": "http://localhost:4533",
      "/manage": "http://localhost:4544"
    }
  }
})
