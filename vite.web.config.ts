import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/renderer",
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer"),
      "@": resolve("src/renderer"),
      "@shared": resolve("src/shared"),
    },
  },
  plugins: [react()],
  build: {
    outDir: resolve("out/web"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("src/renderer/index.html"),
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("node_modules/recharts")) {
            return "charts";
          }

          if (id.includes("node_modules/@tanstack/react-query")) {
            return "query";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
            return "framework";
          }

          return "vendor";
        },
      },
    },
  },
});