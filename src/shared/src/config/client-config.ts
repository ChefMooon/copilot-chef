import { z } from "zod";

export const ClientConfigSchema = z.object({
  connection: z
    .object({
      serverUrl: z.string().default("http://localhost:3001"),
      apiKey: z.string().default(""),
      autoLaunchServer: z.boolean().default(true),
      serverBinaryPath: z.string().default(""),
    })
    .default({}),
  updates: z
    .object({
      checkOnStartup: z.boolean().default(true),
    })
    .default({}),
  ui: z
    .object({
      theme: z.enum(["system", "light", "dark"]).default("system"),
    })
    .default({}),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
