import { randomBytes } from "node:crypto";

import { getSetting, setSetting } from "../../settings/store";

export type MachineTokenMetadata = {
  configured: boolean;
  updatedAt: string | null;
};

function newMachineToken(): string {
  return randomBytes(32).toString("hex");
}

export function getMachineTokenMetadata(): MachineTokenMetadata {
  return {
    configured: typeof getSetting("machine_api_key") === "string" &&
      ((getSetting("machine_api_key") as string).trim().length > 0),
    updatedAt: (getSetting("machine_api_key_updated_at") as string | undefined) ?? null,
  };
}

export function revealMachineToken(): string | null {
  const token = getSetting("machine_api_key");
  return typeof token === "string" && token.trim() ? token : null;
}

export function generateMachineToken(): { token: string; metadata: MachineTokenMetadata } {
  const token = newMachineToken();
  const updatedAt = new Date().toISOString();
  setSetting("machine_api_key", token);
  setSetting("machine_api_key_updated_at", updatedAt);
  return { token, metadata: { configured: true, updatedAt } };
}

export function clearMachineToken(): MachineTokenMetadata {
  setSetting("machine_api_key", "");
  setSetting("machine_api_key_updated_at", new Date().toISOString());
  return getMachineTokenMetadata();
}