import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

import { app } from "electron";

import { resolveLanRuntimeSettings, type LanRuntimeSettings } from "./lib/lan";

let staticServer: Server | null = null;
let staticSettings: LanRuntimeSettings | null = null;

export type StaticWebInfo = {
  running: boolean;
  url: string | null;
  port: number | null;
  bindHost: string | null;
  advertisedHost: string | null;
};

function getWebRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "app.asar", "out", "web");
  }

  const webOut = resolve(process.cwd(), "out", "web");
  if (existsSync(webOut)) return webOut;

  return resolve(process.cwd(), "out", "renderer");
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) {
    return "application/json; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function resolveAssetPath(webRoot: string, urlPath: string): string {
  let decodedPath = "/";
  try {
    decodedPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  } catch {
    return join(webRoot, "index.html");
  }
  const requested = normalize(decodedPath).replace(/^([/\\])+/, "");
  const candidate = resolve(webRoot, requested);
  const relativePath = relative(resolve(webRoot), candidate);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return join(webRoot, "index.html");
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(webRoot, "index.html");
}

export async function startStaticWebServer(): Promise<StaticWebInfo | null> {
  const settings = resolveLanRuntimeSettings(3001);
  if (!settings.webEnabled) {
    await stopStaticWebServer();
    return null;
  }

  if (staticServer) {
    return getStaticWebInfo();
  }

  const webRoot = getWebRoot();
  staticSettings = settings;

  staticServer = createServer((request, response) => {
    const requestUrl = request.url ?? "/";

    if (requestUrl.startsWith("/runtime-config.json")) {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          apiUrl: staticSettings?.apiUrl ?? null,
          webUrl: staticSettings?.webUrl ?? null,
          version: app.getVersion(),
        })
      );
      return;
    }

    const filePath = resolveAssetPath(webRoot, requestUrl);
    if (!existsSync(filePath)) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Copilot Chef browser assets have not been built.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
    });
    createReadStream(filePath).pipe(response);
  });

  await new Promise<void>((resolvePromise, reject) => {
    staticServer?.once("error", reject);
    staticServer?.listen(settings.webPort, settings.webBindHost, () => {
      staticServer?.off("error", reject);
      resolvePromise();
    });
  });

  return getStaticWebInfo();
}

export async function stopStaticWebServer(): Promise<void> {
  if (!staticServer) return;

  await new Promise<void>((resolvePromise) => {
    staticServer?.close(() => resolvePromise());
  });
  staticServer = null;
  staticSettings = null;
}

export async function restartStaticWebServer(): Promise<StaticWebInfo | null> {
  await stopStaticWebServer();
  return startStaticWebServer();
}

export function getStaticWebInfo(): StaticWebInfo {
  return {
    running: staticServer !== null,
    url: staticSettings?.webUrl ?? null,
    port: staticSettings?.webPort ?? null,
    bindHost: staticSettings?.webBindHost ?? null,
    advertisedHost: staticSettings?.webAdvertisedHost ?? null,
  };
}