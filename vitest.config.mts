import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("src/renderer"),
      "@renderer": resolve("src/renderer"),
      "@shared": resolve("src/shared"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["src/renderer/test/setup-tests.ts"],
  },
});