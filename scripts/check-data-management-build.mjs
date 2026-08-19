#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getRepoRequire(root) {
  return createRequire(join(root, "package.json"));
}

function collectFiles(directory, extension) {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path, extension));
    } else if (entry.isFile() && path.endsWith(extension)) {
      files.push(path);
    }
  }
  return files;
}

function assertProductionDependency(root) {
  const packageJson = readJson(join(root, "package.json"));
  const lockJson = readJson(join(root, "package-lock.json"));
  const dependencyRange = packageJson.dependencies?.fflate;

  if (typeof dependencyRange !== "string" || !dependencyRange.trim()) {
    throw new Error("fflate must remain a production dependency");
  }
  if (packageJson.devDependencies?.fflate) {
    throw new Error("fflate must not be moved to devDependencies");
  }
  if (!lockJson.packages?.["node_modules/fflate"]) {
    throw new Error("package-lock.json does not contain node_modules/fflate");
  }

  const requireFromRepo = getRepoRequire(root);
  const resolvedPath = requireFromRepo.resolve("fflate");
  const fflate = requireFromRepo(resolvedPath);
  if (typeof fflate.zipSync !== "function" || typeof fflate.unzipSync !== "function") {
    throw new Error("The installed fflate package does not expose ZIP helpers");
  }

  const archiveSource = readFileSync(
    join(root, "src", "main", "server", "lib", "data-archive.ts"),
    "utf8"
  );
  if (!archiveSource.includes('from "fflate"')) {
    throw new Error("The main-process archive implementation is not using fflate");
  }
}

function assertBuiltMain(root) {
  const mainDirectory = join(root, "out", "main");
  const mainFiles = collectFiles(mainDirectory, ".js");
  if (mainFiles.length === 0) {
    throw new Error("No electron-vite main-process output was found under out/main");
  }

  const bundle = mainFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  const hasRuntimeReference =
    /["']fflate["']/.test(bundle) ||
    (/\bzipSync\b/.test(bundle) && /\bunzipSync\b/.test(bundle));
  if (!hasRuntimeReference) {
    throw new Error(
      "The built main process does not contain or reference the fflate archive runtime"
    );
  }

  const electronViteConfig = readFileSync(
    join(root, "electron.vite.config.mts"),
    "utf8"
  );
  if (!electronViteConfig.includes("externalizeDepsPlugin")) {
    throw new Error("electron-vite main configuration no longer externalizes runtime dependencies");
  }
}

function findPackagedArchive(root) {
  const explicitPath = process.env.DATA_MANAGEMENT_PACKAGE_PATH;
  if (explicitPath) {
    return resolve(root, explicitPath);
  }

  const candidates = collectFiles(join(root, "dist"), ".asar").filter(
    (path) => path.endsWith("app.asar")
  );
  return candidates.sort()[0] ?? null;
}

function normalizeArchivePath(path) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function assertPackagedArchive(root) {
  const archivePath = findPackagedArchive(root);
  if (!archivePath || !existsSync(archivePath)) {
    throw new Error(
      "No packaged app.asar was found; run npm run build:unpack or npm run build:win first"
    );
  }

  const entries = listPackage(archivePath).map(normalizeArchivePath);
  const hasEntry = (entry) => entries.includes(entry);
  if (!hasEntry("out/main/index.js")) {
    throw new Error(`Packaged app is missing out/main/index.js: ${archivePath}`);
  }
  if (!hasEntry("node_modules/fflate/package.json")) {
    throw new Error(
      `Packaged app is missing the production fflate dependency: ${archivePath}`
    );
  }
}

function run() {
  const mode = process.argv[2] ?? "--runtime";
  assertProductionDependency(repoRoot);

  if (mode === "--build" || mode === "--package") {
    assertBuiltMain(repoRoot);
  }
  if (mode === "--package") {
    assertPackagedArchive(repoRoot);
  }

  console.log(`Data-management ${mode.slice(2)} check passed.`);
}

try {
  run();
} catch (error) {
  console.error(
    `Data-management build check failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
}
