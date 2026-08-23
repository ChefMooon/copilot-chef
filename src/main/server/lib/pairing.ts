import { createHash, randomBytes } from "node:crypto";

const PAIRING_TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 4;
const CODE_SPACE_SIZE = 10 ** CODE_LENGTH;

export type PairingCode = {
  code: string;
  expiresAt: string;
};

type PendingPairing = {
  token: string;
  expiresAt: number;
};

const pending = new Map<string, PendingPairing>();

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function cleanupExpired(now = Date.now()): void {
  for (const [key, value] of pending) {
    if (value.expiresAt <= now) pending.delete(key);
  }
}

function createCode(): string {
  return (randomBytes(4).readUInt32BE(0) % CODE_SPACE_SIZE)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

export function createPairingCode(token: string, now = Date.now()): PairingCode {
  cleanupExpired(now);
  let code = createCode();
  while (pending.has(hashCode(code))) {
    code = createCode();
  }
  const expiresAt = now + PAIRING_TTL_MS;
  pending.set(hashCode(code), { token, expiresAt });
  return { code, expiresAt: new Date(expiresAt).toISOString() };
}

export function redeemPairingCode(code: string, now = Date.now()): string | null {
  cleanupExpired(now);
  const key = hashCode(code.trim().toUpperCase());
  const entry = pending.get(key);
  if (!entry || entry.expiresAt <= now) {
    pending.delete(key);
    return null;
  }

  pending.delete(key);
  return entry.token;
}

export function clearPairingCodes(): void {
  pending.clear();
}

export const pairingCodePolicy = {
  ttlMs: PAIRING_TTL_MS,
  length: CODE_LENGTH,
};