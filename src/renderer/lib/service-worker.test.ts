import { describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "./service-worker";

function createServiceWorkerContainer(controller: ServiceWorker | null = null) {
  const listeners = new Map<string, () => void>();
  const registration = { update: vi.fn(() => Promise.resolve()) } as unknown as ServiceWorkerRegistration;

  return {
    controller,
    register: vi.fn(() => Promise.resolve(registration)),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener as () => void);
    }),
    dispatchControllerChange: () => listeners.get("controllerchange")?.(),
    registration,
  } as unknown as ServiceWorkerContainer & {
    dispatchControllerChange: () => void;
    registration: ServiceWorkerRegistration;
  };
}

describe("registerServiceWorker", () => {
  it("bypasses the worker script cache and updates the registration", async () => {
    const serviceWorker = createServiceWorkerContainer();

    registerServiceWorker(serviceWorker, vi.fn());
    await vi.waitFor(() => expect(serviceWorker.registration.update).toHaveBeenCalled());

    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
      updateViaCache: "none",
    });
  });

  it("reloads once when an existing page receives a new controller", () => {
    const serviceWorker = createServiceWorkerContainer({} as ServiceWorker);
    const reload = vi.fn();

    registerServiceWorker(serviceWorker, reload);
    serviceWorker.dispatchControllerChange();
    serviceWorker.dispatchControllerChange();

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload during first-time service-worker installation", () => {
    const serviceWorker = createServiceWorkerContainer();
    const reload = vi.fn();

    registerServiceWorker(serviceWorker, reload);
    serviceWorker.dispatchControllerChange();

    expect(reload).not.toHaveBeenCalled();
  });
});