import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    // CDK uploads this directory to the site bucket.
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    proxy: {
      // Local dev talks to the deployed HttpApi through the same /api path
      // the CloudFront distribution serves in production.
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
  },
});
