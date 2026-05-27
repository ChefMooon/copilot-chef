import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSetting, mockNetworkInterfaces } = vi.hoisted(() => ({
  mockGetSetting: vi.fn<(key: string) => unknown>(),
  mockNetworkInterfaces: vi.fn(),
}));

vi.mock("../../settings/store", () => ({
  getSetting: mockGetSetting,
}));

vi.mock("node:os", () => ({
  networkInterfaces: mockNetworkInterfaces,
}));

import { resolveLanRuntimeSettings } from "./lan";

describe("resolveLanRuntimeSettings", () => {
  beforeEach(() => {
    mockGetSetting.mockReset();
    mockNetworkInterfaces.mockReset();

    mockGetSetting.mockImplementation((key: string) => {
      const defaults: Record<string, unknown> = {
        lan_enabled: true,
        lan_web_enabled: true,
        lan_api_port: 3001,
        lan_web_port: 4173,
        server_port: 3001,
        lan_allowed_origins: [],
      };
      return defaults[key];
    });

    mockNetworkInterfaces.mockReturnValue({
      Ethernet: [
        {
          address: "10.88.111.3",
          family: "IPv4",
          internal: false,
        },
      ],
    });
  });

  it("falls back to the first LAN candidate when a loopback host was saved", () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "lan_advertised_host") {
        return "127.0.0.1";
      }

      const defaults: Record<string, unknown> = {
        lan_enabled: true,
        lan_web_enabled: true,
        lan_api_port: 3001,
        lan_web_port: 4173,
        server_port: 3001,
        lan_allowed_origins: [],
      };
      return defaults[key];
    });

    const settings = resolveLanRuntimeSettings(3001);

    expect(settings.apiAdvertisedHost).toBe("10.88.111.3");
    expect(settings.webAdvertisedHost).toBe("10.88.111.3");
    expect(settings.apiUrl).toBe("http://10.88.111.3:3001");
    expect(settings.webUrl).toBe("http://10.88.111.3:4173");
  });

  it("preserves a non-loopback advertised host override", () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "lan_advertised_host") {
        return "10.88.111.9";
      }

      const defaults: Record<string, unknown> = {
        lan_enabled: true,
        lan_web_enabled: true,
        lan_api_port: 3001,
        lan_web_port: 4173,
        server_port: 3001,
        lan_allowed_origins: [],
      };
      return defaults[key];
    });

    const settings = resolveLanRuntimeSettings(3001);

    expect(settings.apiAdvertisedHost).toBe("10.88.111.9");
    expect(settings.webAdvertisedHost).toBe("10.88.111.9");
  });
});