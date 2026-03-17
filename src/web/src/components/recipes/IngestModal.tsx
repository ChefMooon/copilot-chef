"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingestRecipe } from "@/lib/api";

type IngestModalProps = {
  onClose: () => void;
  onDraft: (draft: unknown) => void;
};

export function IngestModal({ onClose, onDraft }: IngestModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setError(null);
    try {
      const data = await ingestRecipe(url);
      onDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-card border border-cream-dark bg-white p-5 shadow-lg">
        <h2 className="font-serif text-2xl font-semibold text-text">Import from URL</h2>
        <Input
          className="mt-3"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/recipe"
          value={url}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
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
    </div>
  );
}
