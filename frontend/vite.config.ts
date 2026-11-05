import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(),    VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.ico", "robots.txt", "assets/*.png"],
    workbox: {
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
    manifest: {
      name: "LeadsProspect",
      short_name: "LeadsProspect",
      description: "Sistema de prospecção e qualificação de leads",
      theme_color: "#0f172a",
      background_color: "#0f172a",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/assets/login-hero.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/assets/login-hero.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  })].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
