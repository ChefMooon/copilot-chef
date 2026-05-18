/* global console, process */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const electronDir = path.join(rootDir, "node_modules", "electron");
const installScriptPath = path.join(electronDir, "install.js");
const pathMarkerPath = path.join(electronDir, "path.txt");
const distDirPath = path.join(electronDir, "dist");
const prismaClientDir = path.join(rootDir, "node_modules", ".prisma", "client");
const prismaClientIndexPath = path.join(prismaClientDir, "index.js");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runInstallScript() {
  console.log("[predev] Electron binary not found. Running electron install script...");

  const result = spawnSync(process.execPath, [installScriptPath], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    const code = result.status ?? 1;
    console.error(`[predev] Failed to install Electron binary (exit code ${code}).`);
    process.exit(code);
  }
}

function hasPrismaEngineBinary() {
  if (!existsSync(prismaClientDir)) {
    return false;
  }

  try {
    const files = readdirSync(prismaClientDir);
    return files.some(
      (fileName) =>
        fileName.includes("query_engine") || fileName.includes("libquery_engine")
    );
  } catch {
    return false;
  }
}

function prismaNeedsGenerate() {
  if (!existsSync(prismaClientIndexPath)) {
    return true;
  }

  try {
    const indexContents = readFileSync(prismaClientIndexPath, "utf-8");
    const generatedWithoutEngine = indexContents.includes('"copyEngine": false');
    if (generatedWithoutEngine) {
      return true;
    }
  } catch {
    return true;
  }

  return !hasPrismaEngineBinary();
}

function runPrismaGenerate() {
  console.log("[predev] Prisma client is missing local engine binaries. Running prisma generate...");

  const result = spawnSync(npmCommand(), ["run", "db:generate"], {
    stdio: "inherit",
    cwd: rootDir,
  });

  if (result.status !== 0) {
    const code = result.status ?? 1;
    console.error(`[predev] Failed to regenerate Prisma client (exit code ${code}).`);
    process.exit(code);
  }
}

if (!existsSync(installScriptPath)) {
  console.error("[predev] Missing node_modules/electron/install.js. Run npm install first.");
  process.exit(1);
}

const hasPathMarker = existsSync(pathMarkerPath);
const hasDistDir = existsSync(distDirPath);

if (!hasPathMarker || !hasDistDir) {
  runInstallScript();
}

if (!existsSync(pathMarkerPath) || !existsSync(distDirPath)) {
  console.error("[predev] Electron install appears incomplete after repair attempt.");
  process.exit(1);
}

if (prismaNeedsGenerate()) {
  runPrismaGenerate();
}

if (prismaNeedsGenerate()) {
  console.error("[predev] Prisma client is still missing local engine binaries after regeneration.");
  process.exit(1);
}

console.log("[predev] Electron binary check passed.");
