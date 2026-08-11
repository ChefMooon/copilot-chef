import { describe, expect, it } from "vitest";

import { resolveEffectiveRuntimeConfig } from "../runtime-config";

describe("resolveEffectiveRuntimeConfig", () => {
  it("uses local defaults when no settings exist", () => {
    const config = resolveEffectiveRuntimeConfig({ settings: {} });

    expect(config.mode).toBe("local");
    expect(config.api.configuredPort).toBe(3001);
    expect(config.api.bindHost).toBe("127.0.0.1");
    expect(config.api.port).toBe(3001);
    expect(config.web.enabled).toBe(false);
    expect(config.web.url).toBe("http://127.0.0.1:4173");
  });

  it("honors LAN settings and preserves actual bound ports", () => {
    const config = resolveEffectiveRuntimeConfig({
      settings: {
        server_mode: "local",
        server_port: 3001,
        lan_enabled: true,
        lan_web_enabled: true,
        lan_advertised_host: "10.0.0.8",
        lan_web_port: 4173,
      },
      actualApiPort: 3012,
      actualWebPort: 4175,
      lanCandidates: [{ name: "Ethernet", address: "10.0.0.8" }],
    });

    expect(config.lan.enabled).toBe(true);
    expect(config.api.configuredPort).toBe(3001);
    expect(config.api.port).toBe(3012);
    expect(config.api.url).toBe("http://10.0.0.8:3012");
    expect(config.web.enabled).toBe(true);
    expect(config.web.port).toBe(4175);
    expect(config.web.url).toBe("http://10.0.0.8:4175");
  });

  it("supports remote mode without binding local API values", () => {
    const config = resolveEffectiveRuntimeConfig({
      settings: {
        server_mode: "remote",
        remote_server_url: "https://api.example.com",
      },
      mode: "remote",
    });

    expect(config.mode).toBe("remote");
    expect(config.api.configuredPort).toBe(3001);
    expect(config.api.url).toBe("http://127.0.0.1:3001");
  });
});
