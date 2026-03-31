import { z } from "zod";

export const ServerConfigSchema = z.object({
  server: z
    .object({
      port: z.number().default(3001),
      host: z.string().default("127.0.0.1"),
      logLevel: z
        .enum(["debug", "info", "warn", "error"])
        .default("info"),
    })
    .default({}),
  database: z.object({
    url: z.string(),
  }),
  auth: z
    .object({
      tokens: z.array(z.string()).default([]),
      copilotModel: z.string().default("gpt-4o-mini"),
    })
    .default({}),
  updates: z
    .object({
      feedUrl: z.string().default(""),
      checkOnStartup: z.boolean().default(true),
    })
    .default({}),
  cors: z
    .object({
      origins: z
        .array(z.string())
        .default(["tauri://localhost", "http://localhost:5173"]),
    })
    .default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
