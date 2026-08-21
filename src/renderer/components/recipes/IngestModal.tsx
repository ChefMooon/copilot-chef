"use client";

import { useEffect, useRef, useState } from "react";

import { type IngestResult } from "@shared/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/ui/ModalShell";
import { ingestRecipe } from "@/lib/api";

type IngestModalProps = {
  onClose: () => void;
  onDraft: (draft: IngestResult) => void | Promise<void>;
  onViewRecipe?: (recipeId: string) => void;
};

export function IngestModal({ onClose, onDraft, onViewRecipe }: IngestModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("Validating recipe URL...");
  const [error, setError] = useState<string | null>(null);
  const [duplicateRecipe, setDuplicateRecipe] = useState<
    Extract<IngestResult, { duplicate: true }>["existing"] | null
  >(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function handleClose() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    onClose();
  }

  async function handleImport() {
    if (loading || !url.trim()) {
      return;
    }

    setLoading(true);
    setLoadingStage("Fetching recipe page...");
    setError(null);
    setDuplicateRecipe(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const data = await ingestRecipe(url, {
        signal: abortController.signal,
        onProgress: (event) => setLoadingStage(event.message),
      });
      if (data.duplicate) {
        setDuplicateRecipe(data.existing);
        return;
      }

      setLoadingStage("Preparing recipe draft...");
      await onDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleRetry() {
    setDuplicateRecipe(null);
    setError(null);
    setUrl("");
  }

  return (
    <ModalShell
      open
      bodyClassName="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
      className="max-w-lg"
      closeDisabled={loading}
      closeLabel="Close"
      onClose={handleClose}
      title="Import from URL"
      footerRight={
        <>
          {duplicateRecipe ? (
            <Button onClick={handleRetry} type="button" variant="outline">
              Try another URL
            </Button>
          ) : null}
          {duplicateRecipe?.id && onViewRecipe ? (
            <Button onClick={() => onViewRecipe(duplicateRecipe.id)} type="button" variant="default">
              View recipe
            </Button>
          ) : null}
          <Button disabled={loading} onClick={handleClose} type="button" variant="outline">
            Close
          </Button>
          {!duplicateRecipe ? (
            <Button disabled={loading || !url.trim()} form="ingest-recipe-form" type="submit" variant="accent">
              {loading ? "Importing..." : "Import"}
            </Button>
          ) : null}
        </>
      }
    >
          <form id="ingest-recipe-form" onSubmit={(event) => { event.preventDefault(); void handleImport(); }}>
              <label className="text-sm font-semibold text-text" htmlFor="ingest-recipe-url">
                Recipe URL
              </label>
              <Input
                autoFocus
                className="mt-1"
                disabled={loading}
                id="ingest-recipe-url"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError(null);
                  setDuplicateRecipe(null);
                }}
                placeholder="https://example.com/recipe"
                value={url}
              />
              {loading ? (
                <div aria-live="polite" className="mt-4" role="status">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm text-text-muted">
                    <span>{loadingStage}</span>
                    <span className="sr-only">Import in progress</span>
                  </div>
                  <div
                    aria-label="Recipe import progress"
                    aria-valuetext={loadingStage}
                    className="h-2 overflow-hidden rounded-full bg-cream-dark"
                    role="progressbar"
                  >
                    <div className="h-full w-2/5 animate-pulse rounded-full bg-green" />
                  </div>
                </div>
              ) : null}
              {error ? (
                <p className="mt-2 text-sm text-red-600" id="ingest-recipe-error" role="alert">
                  {error}
                </p>
              ) : null}
              {duplicateRecipe ? (
                <div aria-live="polite" className="mt-4 rounded-card border border-orange/30 bg-orange/5 p-3" role="status">
                  <p className="font-semibold text-text">This recipe is already in your library.</p>
                  <p className="mt-1 text-sm text-text-muted">{duplicateRecipe.title}</p>
                  {duplicateRecipe.sourceUrl ? (
                    <p className="mt-1 break-all text-xs text-text-muted">{duplicateRecipe.sourceUrl}</p>
                  ) : null}
                </div>
              ) : null}
          </form>
    </ModalShell>
  );
}
