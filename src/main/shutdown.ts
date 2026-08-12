export type ShutdownGate = {
  request: () => void;
  isQuitting: () => boolean;
  isFinalQuitRequested: () => boolean;
};

export function createShutdownGate(options: {
  requestRuntimeQuit: () => Promise<void>;
  quit: () => void;
  onError: (error: unknown) => void;
}): ShutdownGate {
  let quitting = false;
  let finalQuitRequested = false;
  let quitPromise: Promise<void> | null = null;

  return {
    request: () => {
      if (quitPromise) {
        return;
      }

      quitting = true;
      quitPromise = options
        .requestRuntimeQuit()
        .then(() => {
          finalQuitRequested = true;
          options.quit();
        })
        .catch((error) => {
          quitting = false;
          options.onError(error);
        })
        .finally(() => {
          quitPromise = null;
        });
    },
    isQuitting: () => quitting,
    isFinalQuitRequested: () => finalQuitRequested,
  };
}
