// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IngestResult } from "@shared/types";

import { ingestRecipe } from "@/lib/api";

import { IngestModal } from "./IngestModal";

vi.mock("@/lib/api", () => ({
  ingestRecipe: vi.fn(),
}));

const mockedIngestRecipe = vi.mocked(ingestRecipe);

const duplicateResult: Extract<IngestResult, { duplicate: true }> = {
  duplicate: true,
  existing: {
    id: "recipe-1",
    title: "Already Saved Pasta",
    description: "A saved recipe",
    servings: 2,
    prepTime: null,
    cookTime: null,
    difficulty: null,
    instructions: ["Cook pasta"],
    sourceUrl: "https://example.com/pasta",
    sourceLabel: "example.com",
    origin: "imported",
    favourite: false,
    rating: null,
    cookNotes: null,
    lastMadeAt: null,
    tags: [],
    ingredients: [],
  },
};

afterEach(() => {
  cleanup();
  mockedIngestRecipe.mockReset();
});

describe("IngestModal", () => {
  it("shows loading feedback and disables the form while importing", async () => {
    let resolveRequest!: (result: IngestResult) => void;
    mockedIngestRecipe.mockReturnValue(
      new Promise<IngestResult>((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<IngestModal onClose={vi.fn()} onDraft={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipe URL"), {
      target: { value: "https://example.com/recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByRole("status")).toHaveTextContent("Fetching recipe page...");
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Importing..." })).toBeDisabled();

    resolveRequest(duplicateResult);
    await waitFor(() => {
      expect(screen.getByText("This recipe is already in your library.")).toBeVisible();
    });
  });

  it("keeps duplicate imports visible and allows retry", async () => {
    mockedIngestRecipe.mockResolvedValueOnce(duplicateResult);
    const onClose = vi.fn();
    const onDraft = vi.fn();

    render(<IngestModal onClose={onClose} onDraft={onDraft} />);

    fireEvent.change(screen.getByLabelText("Recipe URL"), {
      target: { value: "https://example.com/pasta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText("Already Saved Pasta")).toBeVisible();
    });
    expect(onDraft).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try another URL" }));
    expect(screen.queryByText("Already Saved Pasta")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Recipe URL")).toHaveValue("");
  });

  it("offers to view an existing duplicate recipe", async () => {
    mockedIngestRecipe.mockResolvedValueOnce(duplicateResult);
    const onViewRecipe = vi.fn();

    render(
      <IngestModal
        onClose={vi.fn()}
        onDraft={vi.fn()}
        onViewRecipe={onViewRecipe}
      />
    );

    fireEvent.change(screen.getByLabelText("Recipe URL"), {
      target: { value: "https://example.com/pasta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText("Already Saved Pasta")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "View recipe" }));

    expect(onViewRecipe).toHaveBeenCalledWith("recipe-1");
  });
});
