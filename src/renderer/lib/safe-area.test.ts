// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  applySafeAreaFallback,
  SAFE_AREA_FALLBACK_TOP_PX,
  shouldApplySafeAreaFallback,
} from "./safe-area";

const mockStandalone = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches, media: query }),
  });
};

describe("shouldApplySafeAreaFallback", () => {
  it("requires standalone mode and a zero-resolved inset", () => {
    expect(shouldApplySafeAreaFallback(true, 0)).toBe(true);
    expect(shouldApplySafeAreaFallback(false, 0)).toBe(false);
    expect(shouldApplySafeAreaFallback(true, 47)).toBe(false);
    expect(shouldApplySafeAreaFallback(false, 47)).toBe(false);
  });

  it("treats sub-pixel insets as zero", () => {
    expect(shouldApplySafeAreaFallback(true, 0.5)).toBe(true);
  });
});

describe("applySafeAreaFallback", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-safe-area-top");
    document.body.innerHTML = "";
  });

  it("applies fallback top inset when standalone and env() resolves to zero", () => {
    mockStandalone(true);

    const applied = applySafeAreaFallback();

    expect(applied).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("--app-safe-area-top")
    ).toBe(`${SAFE_AREA_FALLBACK_TOP_PX}px`);
  });

  it("does not apply fallback outside standalone display mode", () => {
    mockStandalone(false);

    const applied = applySafeAreaFallback();

    expect(applied).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--app-safe-area-top")).toBe("");
  });

  it("clears a fallback when standalone mode no longer needs it", () => {
    mockStandalone(true);
    applySafeAreaFallback();

    mockStandalone(false);
    const applied = applySafeAreaFallback();

    expect(applied).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--app-safe-area-top")).toBe("");
  });

  it("does nothing without a target element", () => {
    mockStandalone(true);

    expect(applySafeAreaFallback(null)).toBe(false);
  });
});
