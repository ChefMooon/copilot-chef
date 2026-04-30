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
    },
  },
});