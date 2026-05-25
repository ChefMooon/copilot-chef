/* global console, process */

import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import { Writable } from "node:stream";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const webAssetsDir = join(projectRoot, "out", "web", "assets");
const mainBundlePath = join(projectRoot, "out", "main", "index.js");

async function gzipSize(filePath) {
  let total = 0;
  const sink = new (class extends Writable {
    _write(chunk, _encoding, callback) {
      total += chunk.length;
      callback();
    }
  })();

  await pipeline(createReadStream(filePath), createGzip(), sink);
  return total;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

async function listWebAssets() {
  const entries = await readdir(webAssetsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(js|css)$/.test(name));

  const stats = await Promise.all(
    files.map(async (name) => {
      const filePath = join(webAssetsDir, name);
      const fileStat = await stat(filePath);
      const gzipped = await gzipSize(filePath);
      return {
        name,
        bytes: fileStat.size,
        gzipBytes: gzipped,
      };
    })
  );

  return stats.sort((a, b) => b.bytes - a.bytes);
}

async function main() {
  console.log("Bundle size report");
  console.log("==================");

  try {
    const mainStat = await stat(mainBundlePath);
    const mainGzip = await gzipSize(mainBundlePath);
    console.log(`Main bundle: ${formatKb(mainStat.size)} (gzip ${formatKb(mainGzip)})`);
  } catch {
    console.log("Main bundle: not found (run npm run build first)");
  }

  console.log("");
  console.log("Renderer assets:");

  try {
    const assets = await listWebAssets();
    if (assets.length === 0) {
      console.log("  No JS/CSS assets found.");
      return;
    }

    for (const asset of assets) {
      console.log(
        `  ${asset.name} - ${formatKb(asset.bytes)} (gzip ${formatKb(asset.gzipBytes)})`
      );
    }
  } catch {
    console.log("  Renderer assets not found (run npm run build:web first)");
  }
}

void main();
