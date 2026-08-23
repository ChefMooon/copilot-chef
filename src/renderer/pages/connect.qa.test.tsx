// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConnectPage from "./connect";
import {
  expectKeyboardFocusable,
  expectMainLandmark,
  expectPrimaryHeading,
} from "@/test/qa/browser-baseline";

const mocks = vi.hoisted(() => ({
  metadata: { staleReason: null as string | null },
  importedConnection: null as { apiUrl: string; token: string } | null,
  savedConnection: null as { apiUrl: string; token: string } | null,
  clearCalls: 0,
  savedCalls: 0,
  navigateCalls: [] as string[],
  queryClearCalls: 0,
  resetCalls: 0,
  pairingCalls: 0,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    clear: () => {
      mocks.queryClearCalls += 1;
    },
  }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => (path: string) => {
      mocks.navigateCalls.push(path);
    },
  };
});

vi.mock("@/lib/platform", () => ({
  clearBrowserConnection: () => {
    mocks.clearCalls += 1;
  },
  getBrowserConnectionMetadata: () => mocks.metadata,
  getBrowserConnection: () => mocks.savedConnection,
  importBrowserConnectionFromLocation: () => mocks.importedConnection,
  markBrowserConnectionStale: vi.fn(),
  saveBrowserConnection: () => {
    mocks.savedCalls += 1;
  },
  getPlatform: () => ({
    redeemBrowserPairingCode: async (apiUrl: string) => {
      mocks.pairingCalls += 1;
      return { apiUrl, token: "paired-token" };
    },
  }),
}));

vi.mock("@/lib/config", () => ({
  getCachedConfig: () => ({ url: "", token: "", mode: "local" }),
  loadServerConfig: async () => ({ url: "http://127.0.0.1:3001", token: "t", mode: "local" }),
  resetConfigCache: () => {
    mocks.resetCalls += 1;
  },
}));

describe("ConnectPage QA baseline", () => {
  beforeEach(() => {
    mocks.metadata = { staleReason: null };
    mocks.importedConnection = null;
    mocks.savedConnection = null;
    mocks.clearCalls = 0;
    mocks.savedCalls = 0;
    mocks.navigateCalls = [];
    mocks.queryClearCalls = 0;
    mocks.resetCalls = 0;
    mocks.pairingCalls = 0;

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/health")) {
        return { ok: true, status: 200 } as Response;
      }

      return { ok: true, status: 200 } as Response;
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders baseline accessibility landmarks and named controls", () => {
    render(
      <MemoryRouter>
        <ConnectPage />
      </MemoryRouter>
    );

    expectMainLandmark();
    expectPrimaryHeading(/connect local recipe book/i);

    const apiUrlInput = screen.getByLabelText(/api url/i);
    const tokenInput = screen.getByLabelText(/token/i);
    const connectButton = screen.getByRole("button", { name: /^connect$/i });

    expectKeyboardFocusable(apiUrlInput as HTMLElement);
    expectKeyboardFocusable(tokenInput as HTMLElement);
    expectKeyboardFocusable(connectButton as HTMLElement);
  });

  it("shows validation feedback when required fields are empty", () => {
    render(
      <MemoryRouter>
        <ConnectPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(screen.getByText(/enter both the api url and token/i)).toBeTruthy();
  });

  it("connect flow saves browser connection and navigates to home", async () => {
    render(
      <MemoryRouter>
        <ConnectPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/api url/i), {
      target: { value: "http://127.0.0.1:3001" },
    });

    fireEvent.change(screen.getByLabelText(/token/i), {
      target: { value: "sample-token" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    await vi.waitFor(() => {
      expect(mocks.savedCalls).toBe(1);
      expect(mocks.resetCalls).toBe(1);
      expect(mocks.queryClearCalls).toBe(1);
      expect(mocks.navigateCalls).toContain("/");
    });
  });
});
