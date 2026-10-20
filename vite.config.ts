import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "MuMu",
        short_name: "MuMu",
        description: "Chats, posts, calls and live — with people and businesses.",
        theme_color: "#00a8ff",
        background_color: "#f5f6fa",
        display: "standalone",
        orientation: "portrait",
        start_url: "/chats",
        scope: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell offline; API, sockets and media are always live.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173, allowedHosts: [".trycloudflare.com"] },
});
