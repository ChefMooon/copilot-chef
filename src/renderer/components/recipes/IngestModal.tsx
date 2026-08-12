"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { type IngestResult } from "@shared/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingestRecipe } from "@/lib/api";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

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

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[autofocus]") ?? getFocusable()[0] ?? panel;
    initialTarget.focus();

    const tabHandler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", tabHandler);

    return () => {
      window.removeEventListener("keydown", tabHandler);
      previousFocus?.focus();
    };
  }, [portalRoot]);

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

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
      ref={overlayRef}
      role="presentation"
    >
        <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-card border border-cream-dark bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
          aria-labelledby="ingest-modal-title"
          aria-busy={loading}
        tabIndex={-1}
      >
        <div className="border-b border-cream-dark px-4 py-3 sm:px-5">
          <h2 className="font-serif text-2xl font-semibold text-text" id="ingest-modal-title">
            Import from URL
          </h2>
        </div>
          <form onSubmit={(event) => { event.preventDefault(); void handleImport(); }}>
            <div className="flex-1 px-4 py-3 sm:px-5 sm:py-4">
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
            </div>
            <div className="flex justify-end gap-2 border-t border-cream-dark px-4 py-3 sm:px-5">
              {duplicateRecipe ? (
                <Button onClick={handleRetry} type="button" variant="outline">
                  Try another URL
                </Button>
              ) : null}
              {duplicateRecipe?.id && onViewRecipe ? (
                <Button
                  onClick={() => {
                    if (duplicateRecipe.id) {
                      onViewRecipe(duplicateRecipe.id);
                    }
                  }}
                  type="button"
                  variant="default"
                >
                  View recipe
                </Button>
              ) : null}
              <Button disabled={loading} onClick={handleClose} type="button" variant="outline">
                Close
              </Button>
              {!duplicateRecipe ? (
                <Button disabled={loading || !url.trim()} type="submit" variant="default">
                  {loading ? "Importing..." : "Import"}
                </Button>
              ) : null}
            </div>
          </form>
      </div>
    </div>,
    portalRoot
  );
}
