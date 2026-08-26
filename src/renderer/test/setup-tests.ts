import * as matchers from "@testing-library/jest-dom/matchers";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect } from "vitest";

import { setCachedConfigForTests } from "@/lib/config";

if (typeof ResizeObserver === "undefined") {
  class TestResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = TestResizeObserver;
}

if (typeof PointerEvent === "undefined") {
  const PointerEventFallback =
    typeof MouseEvent === "undefined" ? class extends Event {} : MouseEvent;

  globalThis.PointerEvent = PointerEventFallback as typeof PointerEvent;
}

expect.extend(matchers);

beforeEach(() => {
  setCachedConfigForTests({
    url: "http://127.0.0.1:3001",
    token: "test-token",
    mode: "local",
  });
});

afterEach(() => {
  setCachedConfigForTests(null);
});
