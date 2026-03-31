import { serve } from "@hono/node-server";
import { bootstrapDatabase } from "@copilot-chef/core";
import { loadServerConfig } from "@copilot-chef/shared";

import { createApp } from "./app.js";

export async function main() {
  const config = loadServerConfig();

  // Set DATABASE_URL from config so Core's Prisma client picks it up
  if (config.database.url) {
    process.env["DATABASE_URL"] = config.database.url;
  }

  // Set Copilot model from config
  if (config.auth.copilotModel) {
    process.env["COPILOT_MODEL"] = config.auth.copilotModel;
  }

  await bootstrapDatabase();

  const app = createApp(config);

  serve(
    {
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
    },
    (info) => {
      console.info(
        `[copilot-chef-server] listening on http://${info.address}:${info.port}`
      );
    }
  );
}

main().catch((err) => {
  console.error("[copilot-chef-server] startup failed", err);
  process.exit(1);
});
