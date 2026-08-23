import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { createApiErrorEnvelope } from "@shared/api/errors";
import { createPairingCode, redeemPairingCode } from "../lib/pairing.js";
import { revealMachineToken } from "../lib/machine-token.js";

const redeemSchema = z.object({ code: z.string().regex(/^\d{4}$/) });

function getBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function matchesMachineToken(input: string | null, configured: string | null): boolean {
  if (!input || !configured || input.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(configured));
}

function unauthorized(message: string) {
  return new Response(JSON.stringify(createApiErrorEnvelope({ code: "UNAUTHORIZED", message })), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const pairingRoutes = new Hono();

pairingRoutes.post("/pairing/code", (c) => {
  const token = getBearerToken(c.req.header("authorization"));
  if (!matchesMachineToken(token, revealMachineToken())) {
    return unauthorized("Unauthorized");
  }

  return c.json(createPairingCode(token));
});

pairingRoutes.post("/pairing/redeem", async (c) => {
  const body = redeemSchema.parse(await c.req.json());
  const token = redeemPairingCode(body.code);
  if (!token) return unauthorized("Invalid or expired pairing code");

  return c.json({ token });
});