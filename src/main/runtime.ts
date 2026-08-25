import { startServer, stopServer } from "./server/start";
import {
  startStaticWebServer,
  stopStaticWebServer,
} from "./server/static-web";
import { logLifecycle, sanitizeLogValue } from "./logging";

export type RuntimeStatus =
  | "stopped"
  | "starting"
  | "running"
  | "restarting"
  | "stopping"
  | "failed";

export type RuntimeLifecycleResult = {
  status: RuntimeStatus;
  apiUrl?: string;
  webUrl?: string;
};

export class LocalRecipeBookRuntime {
  private status: RuntimeStatus = "stopped";
  private startPromise: Promise<RuntimeLifecycleResult> | null = null;
  private stopPromise: Promise<void> | null = null;
  private quitPromise: Promise<void> | null = null;

  getStatus(): RuntimeStatus {
    return this.status;
  }

  async start(): Promise<RuntimeLifecycleResult> {
    if (this.startPromise) {
      logLifecycle("runtime.start.reused", { status: this.status });
      return this.startPromise;
    }

    this.status = "starting";
    logLifecycle("runtime.start.begin", { status: this.status });
    this.startPromise = (async () => {
      try {
        const api = await startServer();

        try {
          const staticWeb = await startStaticWebServer({
            runtimeSettings: api.runtimeSettings,
          });

          this.status = "running";
          logLifecycle("runtime.start.success", {
            status: this.status,
            apiUrl: sanitizeLogValue(api.url),
            webUrl: sanitizeLogValue(staticWeb?.url ?? null),
          });

          return {
            status: "running",
            apiUrl: api.url,
            webUrl: staticWeb?.url ?? undefined,
          };
        } catch (error) {
          await Promise.allSettled([stopStaticWebServer(), stopServer()]);
          throw error;
        }
      } catch (error) {
        this.status = "failed";
        logLifecycle("runtime.start.failed", {
          status: this.status,
          error: sanitizeLogValue(
            error instanceof Error ? { name: error.name, message: error.message } : error
          ),
        });
        throw error;
      } finally {
        this.startPromise = null;
      }
    })();

    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (this.status === "stopped") {
      logLifecycle("runtime.stop.skipped", { status: this.status });
      return;
    }

    if (this.stopPromise) {
      logLifecycle("runtime.stop.reused", { status: this.status });
      return this.stopPromise;
    }

    this.status = "stopping";
    const stopStartedAt = Date.now();
    logLifecycle("runtime.stop.begin", {
      status: this.status,
      startedAt: new Date(stopStartedAt).toISOString(),
    });
    this.stopPromise = (async () => {
      try {
        await Promise.all([stopStaticWebServer(), stopServer()]);
      } finally {
        this.status = "stopped";
        const completedAt = Date.now();
        logLifecycle("runtime.stop.complete", {
          status: this.status,
          elapsedMs: completedAt - stopStartedAt,
        });
        this.stopPromise = null;
      }
    })();

    return this.stopPromise;
  }

  async requestQuit(): Promise<void> {
    if (this.quitPromise) {
      logLifecycle("runtime.quit.reused", { status: this.status });
      return this.quitPromise;
    }

    const quitStartedAt = Date.now();
    logLifecycle("runtime.quit.begin", {
      status: this.status,
      startedAt: new Date(quitStartedAt).toISOString(),
    });
    this.quitPromise = (async () => {
      await this.stop();
    })().finally(() => {
      const completedAt = Date.now();
      logLifecycle("runtime.quit.complete", {
        status: this.status,
        elapsedMs: completedAt - quitStartedAt,
      });
      this.quitPromise = null;
    });

    return this.quitPromise;
  }
}
