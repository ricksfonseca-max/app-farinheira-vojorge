import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Em desenvolvimento, /umidade-api vai para o serviço Python local
    proxy: {
      "/umidade-api": {
        target: process.env.UMIDADE_API_LOCAL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/umidade-api/, ""),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
