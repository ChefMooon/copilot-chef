import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { useToast } from "./toast-provider";
import { getPlatform, type UpdateInfo, type UpdateProgress, type UpdateState } from "@/lib/platform";

const initialState: UpdateState = { status: "idle" };

type UpdateContextValue = {
  supported: boolean;
  state: UpdateState;
  checkForUpdates: () => Promise<unknown>;
  installUpdate: () => Promise<unknown>;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

function describeVersion(info: UpdateInfo | undefined): string {
  return info?.version ? `Version ${info.version} is available.` : "A new version is available.";
}

export function UpdateProvider({ children }: PropsWithChildren) {
  const platform = getPlatform();
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<UpdateState>(initialState);

  useEffect(() => {
    if (typeof platform.getUpdatesSupported !== "function") return;
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void platform.getUpdatesSupported().then((isSupported) => {
      if (!mounted || !isSupported) return;
      setSupported(true);
      void platform.getUpdateState().then((next) => {
        if (mounted) setState(next);
      });

      const unsubscribe = platform.subscribeUpdates({
        onAvailable: (info) => setState({ status: "available", info }),
        onProgress: (progress: UpdateProgress) =>
          setState((current) => ({
            status: "downloading",
            info: current.info ?? {},
            progress,
          })),
        onDownloaded: (info) => setState({ status: "downloaded", info }),
        onNotAvailable: () => setState({ status: "not-available" }),
        onError: (message) =>
          setState((current) => ({ ...current, status: "error", error: message })),
      });

      if (!mounted) unsubscribe();
      else cleanup = unsubscribe;
    }).catch(() => {});

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [platform]);

  useEffect(() => {
    if (!supported) return;
    if (state.status === "available") {
      toast({
        title: "Update available",
        description: `${describeVersion(state.info)} Downloading in the background.`,
        duration: 9000,
      });
    }
    if (state.status === "downloaded") {
      toast({
        title: "Update ready",
        description: describeVersion(state.info),
        duration: 0,
        action: {
          label: "Install & Restart",
          onClick: async () => {
            try {
              await platform.installUpdate();
            } catch (error) {
              toast({
                title: "Update installation failed",
                description: error instanceof Error ? error.message : "Could not install the update.",
                variant: "error",
              });
            }
          },
        },
      });
    }
    if (state.status === "error") {
      toast({
        title: "Update failed",
        description: state.error,
        variant: "error",
      });
    }
  }, [platform, state, toast]);

  const value = useMemo(
    () => ({
      supported,
      state,
      checkForUpdates: platform.checkForUpdates,
      installUpdate: platform.installUpdate,
    }),
    [platform, state, supported]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdates(): UpdateContextValue {
  const context = useContext(UpdateContext);
  if (!context) throw new Error("useUpdates must be used within UpdateProvider");
  return context;
}
