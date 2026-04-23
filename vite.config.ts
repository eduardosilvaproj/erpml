import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || "1.0.0"),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      devOptions: {
        enabled: false,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(js|css|html)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|ico|woff2)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name: "ErpML - ERP Mercado Livre",
        short_name: "ErpML",
        description: "Sistema ERP integrado ao Mercado Livre",
        theme_color: "#7c3aed",
        background_color: "#0f0a1e",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        prefer_related_applications: false,
        icons: [
          {
            src: "pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
