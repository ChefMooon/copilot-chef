import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import type { ServerConfig } from "@shared/config/server-config";

import { createAuthMiddleware } from "./middleware/auth.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { healthRoutes } from "./routes/health.js";
import { mealsRoutes } from "./routes/meals.js";
import { menuExportRoutes } from "./routes/menu-export.js";
import { mealTypesRoutes } from "./routes/meal-types.js";
import { groceryListsRoutes } from "./routes/grocery-lists.js";
import { recipesRoutes } from "./routes/recipes.js";
import { preferencesRoutes } from "./routes/preferences.js";
import { chatRoutes } from "./routes/chat.js";
import { chatSessionsRoutes } from "./routes/chat-sessions.js";
import { personasRoutes } from "./routes/personas.js";
import { statsRoutes } from "./routes/stats.js";
import { sessionProbeRoutes } from "./routes/session-probe.js";

export function createApp(config: ServerConfig) {
  const app = new Hono();

  // Request logger
  // Default Hono logger emits method/path/status/duration only — no Authorization headers logged.
  app.use("*", logger());

  // CORS
  app.use(
    "*",
    cors({
      origin: config.cors.origins,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-request-id",
        "x-machine-caller-id",
        "x-machine-source",
      ],
      exposeHeaders: [
        "x-session-id",
        "x-chat-session-id",
        "x-request-id",
      ],
    })
  );

  // Auth middleware (health endpoint bypassed inside the middleware)
  app.use("/api/*", createAuthMiddleware(config));

  // Rate limiter — active in LAN mode (host bound to 0.0.0.0) to protect against untrusted clients
  if (config.server.host !== "127.0.0.1") {
    app.use("/api/*", createRateLimitMiddleware());
  }

  // Global error handler
  app.onError((err, c) => {
    console.error("[server] unhandled error", err);
    return c.json({ error: err.message ?? "Internal server error" }, 500);
  });

  // Routes
  app.route("/api", healthRoutes);
  app.route("/api", mealsRoutes);
  app.route("/api", menuExportRoutes);
  app.route("/api", mealTypesRoutes);
  app.route("/api", groceryListsRoutes);
  app.route("/api", recipesRoutes);
  app.route("/api", preferencesRoutes);
  app.route("/api", chatRoutes);
  app.route("/api", chatSessionsRoutes);
  app.route("/api", personasRoutes);
  app.route("/api", statsRoutes);
  app.route("/api", sessionProbeRoutes);

  return app;
}
