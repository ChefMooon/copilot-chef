export function registerServiceWorker(
  serviceWorker: ServiceWorkerContainer,
  reload: () => void
) {
  const hadController = Boolean(serviceWorker.controller);
  let hasReloadedForUpdate = false;

  serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || hasReloadedForUpdate) {
      return;
    }

    hasReloadedForUpdate = true;
    reload();
  });

  void serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => undefined);
}