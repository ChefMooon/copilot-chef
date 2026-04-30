self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname === "/runtime-config.json") return;

  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return new Response(
          "Copilot Chef is offline. Reconnect to the desktop app and refresh.",
          { headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
      throw new Error("Offline");
    })
  );
});