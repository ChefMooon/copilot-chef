"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { type IngestResult } from "@copilot-chef/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingestRecipe } from "@/lib/api";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type IngestModalProps = {
  onClose: () => void;
  onDraft: (draft: IngestResult) => void | Promise<void>;
};

export function IngestModal({ onClose, onDraft }: IngestModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
    setLoading(true);
    setError(null);
    try {
      const data = await ingestRecipe(url);
      await onDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
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
        aria-label="Import recipe from URL"
        tabIndex={-1}
      >
        <div className="border-b border-cream-dark px-4 py-3 sm:px-5">
          <h2 className="font-serif text-2xl font-semibold text-text">Import from URL</h2>
        </div>
        <div className="flex-1 px-4 py-3 sm:px-5 sm:py-4">
          <Input
            autoFocus
            className="mt-1"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/recipe"
            value={url}
          />
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-cream-dark px-4 py-3 sm:px-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={loading || !url}
            onClick={() => void handleImport()}
            type="button"
            variant="default"
          >
            {loading ? "Fetching recipe..." : "Import"}
          </Button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
