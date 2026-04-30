/* global console, process */

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const electronDir = path.join(rootDir, "node_modules", "electron");
const installScriptPath = path.join(electronDir, "install.js");
const pathMarkerPath = path.join(electronDir, "path.txt");
const distDirPath = path.join(electronDir, "dist");

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

console.log("[predev] Electron binary check passed.");
