import { useSyncExternalStore } from "react";

import {
  getCachedConfig,
  subscribeConfigUpdates,
  type ServerConfig,
} from "@/lib/config";

export function useServerConfig(): ServerConfig | null {
  return useSyncExternalStore(
    subscribeConfigUpdates,
    getCachedConfig,
    () => null
  );
}
