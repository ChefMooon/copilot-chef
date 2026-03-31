import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@github/copilot-sdk"] })],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
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
      rollupOptions: {
        input: resolve("src/renderer/index.html"),
      },
    },
  },
});
