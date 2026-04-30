// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/providers/toast-provider";

import { AddRecipeModal } from "./AddRecipeModal";

const originalCrypto = globalThis.crypto;

describe("AddRecipeModal", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("renders even when crypto.randomUUID is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: vi.fn((array: Uint8Array) => {
          array.fill(7);
          return array;
        }),
      },
    });

    expect(() => {
      render(
        <ToastProvider>
          <AddRecipeModal
            onClose={() => {}}
            onSave={async () => {}}
            open={false}
          />
        </ToastProvider>
      );
    }).not.toThrow();
  });
});