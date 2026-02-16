import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    // Prevent dependency scanner from treating build output HTML as an entry.
    entries: [path.resolve(__dirname, "client/index.html")],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/share": "http://127.0.0.1:8787",
      "/dav": "http://127.0.0.1:8787",
      "/privacy": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: path.resolve(__dirname, "client", "dist"),
    emptyOutDir: true,
  },
});
