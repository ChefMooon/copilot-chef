import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import {
  patchPreferences,
  resetPreferences,
  type SettingsPreferences,
} from "@/lib/api";

export const preferenceQueryKey = ["preferences"] as const;

type SettingsControllerOptions = {
  preferences: SettingsPreferences | undefined;
};

export function useSettingsController({
  preferences,
}: SettingsControllerOptions) {
  const queryClient = useQueryClient();
  const patchMutation = useMutation({ mutationFn: patchPreferences });
  const resetMutation = useMutation({ mutationFn: resetPreferences });
  const operationQueueRef = useRef(Promise.resolve());
  const generationRef = useRef(0);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState(false);

  const enqueue = useCallback(<T,>(operation: () => Promise<T>) => {
    const next = operationQueueRef.current.then(operation, operation);
    operationQueueRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const commitPatch = useCallback(
    (patch: Partial<SettingsPreferences>, optimistic = true) => {
      if (!preferences) {
        return Promise.resolve(null);
      }

      const operationGeneration = generationRef.current;
      const previous =
        queryClient.getQueryData<SettingsPreferences>(preferenceQueryKey) ??
        preferences;

      if (optimistic) {
        queryClient.setQueryData<SettingsPreferences>(preferenceQueryKey, {
          ...previous,
          ...patch,
        });
      }

      setSaveError(false);
      setPendingSaves((count) => count + 1);

      return enqueue(async () => {
        if (operationGeneration !== generationRef.current) {
          return null;
        }

        try {
          const next = await patchMutation.mutateAsync(patch);
          if (operationGeneration === generationRef.current) {
            queryClient.setQueryData(preferenceQueryKey, next);
          }
          return next;
        } catch (error) {
          if (optimistic && operationGeneration === generationRef.current) {
            queryClient.setQueryData(preferenceQueryKey, previous);
          }
          setSaveError(true);
          throw error;
        } finally {
          setPendingSaves((count) => Math.max(0, count - 1));
        }
      });
    },
    [enqueue, patchMutation, preferences, queryClient]
  );

  const reset = useCallback(() => {
    generationRef.current += 1;
    setSaveError(false);
    setPendingSaves(0);

    return enqueue(async () => {
      const next = await resetMutation.mutateAsync();
      queryClient.setQueryData(preferenceQueryKey, next);
      await queryClient.invalidateQueries({ queryKey: preferenceQueryKey });
      return next;
    });
  }, [enqueue, queryClient, resetMutation]);

  return {
    clearSaveError: () => setSaveError(false),
    commitPatch,
    pendingSaves,
    reset,
    resetting: resetMutation.isPending,
    saveError,
  };
}
