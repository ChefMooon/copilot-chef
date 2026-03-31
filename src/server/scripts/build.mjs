import { build } from "esbuild";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.resolve(projectRoot, "dist");

rmSync(distDir, { recursive: true, force: true });

const shared = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  tsconfig: path.resolve(projectRoot, "tsconfig.json"),
  absWorkingDir: projectRoot,
  logLevel: "info",
  outExtension: { ".js": ".cjs" },
  external: ["@hono/node-server", "hono", "zod"],
};

await Promise.all([
  build({
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    ...shared,
  }),
  build({
    entryPoints: ["src/cli.ts"],
    outdir: "dist",
    ...shared,
  }),
]);
