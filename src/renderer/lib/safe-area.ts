declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export const SAFE_AREA_FALLBACK_TOP_PX = 24;

export function isStandaloneDisplay(win: Window = window): boolean {
  const media = win.matchMedia?.("(display-mode: standalone)");
  return Boolean(media?.matches) || win.navigator.standalone === true;
}

export function measureSafeAreaTopInset(doc: Document = document): number {
  const view = doc.defaultView;
  if (!view || !doc.body) {
    return 0;
  }

  const probe = doc.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = "0";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  doc.body.appendChild(probe);

  const resolved = parseFloat(view.getComputedStyle(probe).paddingTop);
  probe.remove();
  return Number.isFinite(resolved) ? resolved : 0;
}

export function shouldApplySafeAreaFallback(
  standalone: boolean,
  resolvedTopInsetPx: number
): boolean {
  return standalone && resolvedTopInsetPx < 1;
}

export function applySafeAreaFallback(
  target: HTMLElement | null = typeof document !== "undefined"
    ? document.documentElement
    : null
): boolean {
  if (!target) {
    return false;
  }

  const standalone = isStandaloneDisplay();
  const resolvedTopInset = measureSafeAreaTopInset();
  if (!shouldApplySafeAreaFallback(standalone, resolvedTopInset)) {
    target.style.removeProperty("--app-safe-area-top");
    return false;
  }

  target.style.setProperty("--app-safe-area-top", `${SAFE_AREA_FALLBACK_TOP_PX}px`);
  return true;
}
