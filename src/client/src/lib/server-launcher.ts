import { Child, Command } from "@tauri-apps/plugin-shell";

import { type ClientConfig } from "@copilot-chef/shared";

const MAX_RESTARTS = 3;

let serverProcess: Child | null = null;
let restartCount = 0;
let isShuttingDown = false;

export async function launchServer(config: ClientConfig): Promise<void> {
  if (!config.connection.autoLaunchServer) return;

  const binaryName =
    config.connection.serverBinaryPath || "copilot-chef-server";

  const command = Command.create(binaryName, ["start"]);

  command.on("close", (data) => {
    if (isShuttingDown) return;

    console.warn(
      `Server process exited with code ${data.code}. Restart #${restartCount + 1}`
    );

    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      setTimeout(() => {
        void launchServer(config);
      }, 1000 * restartCount);
    } else {
      console.error("Server failed to restart after maximum attempts.");
    }
  });

  command.on("error", (error) => {
    console.error("Server process error:", error);
  });

  command.stdout.on("data", (line: string) => {
    console.log(`[server] ${line}`);
  });

  command.stderr.on("data", (line: string) => {
    console.error(`[server] ${line}`);
  });

  serverProcess = await command.spawn();
}

export async function stopServer(): Promise<void> {
  if (!serverProcess) return;
  isShuttingDown = true;

  try {
    await serverProcess.kill();

    // Give it up to 5 seconds to exit
    await Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  } catch {
    // Process may have already exited
  } finally {
    serverProcess = null;
    isShuttingDown = false;
  }
}
