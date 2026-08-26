import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./router";
import { getPlatform } from "./lib/platform";
import { applySafeAreaFallback } from "./lib/safe-area";
import { PreferenceProvider } from "./lib/preferences";
import { registerServiceWorker } from "./lib/service-worker";
import { TooltipProvider } from "./components/ui/tooltip";

import "./globals.css";

if (getPlatform().runtime === "browser") {
  applySafeAreaFallback();
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <StrictMode>
    <PreferenceProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </PreferenceProvider>
  </StrictMode>
);

if (getPlatform().runtime === "browser" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    registerServiceWorker(navigator.serviceWorker, () => window.location.reload());
  });
}
