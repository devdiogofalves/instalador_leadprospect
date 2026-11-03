import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Nunca gerar source maps em produção — impede que o código TS/TSX original
    // fique legível via DevTools mesmo com o bundle minificado.
    sourcemap: false,
  },
  esbuild: {
    // Remove todos os console.log / console.error e debugger do bundle de produção.
    // Em desenvolvimento continuam funcionando normalmente.
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
