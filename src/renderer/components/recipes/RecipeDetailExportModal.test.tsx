// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipePayload } from "@/lib/api";
import { RecipeDetailExportModal } from "./RecipeDetailExportModal";

const recipe: RecipePayload = {
  id: "recipe-1",
  title: "Test Soup",
  description: "A warm soup",
  servings: 2,
  prepTime: 5,
  cookTime: 10,
  difficulty: "Easy",
  cuisine: "Other",
  instructions: ["Stir gently"],
  sourceUrl: "https://example.com/soup",
  sourceLabel: "Example",
  origin: "manual",
  favourite: false,
  rating: null,
  cookNotes: null,
  lastMadeAt: null,
  ingredients: [{
    id: "ingredient-1",
    name: "Water",
    quantity: 1,
    quantityNumerator: 1,
    quantityDenominator: 1,
    unit: "cup",
    group: null,
    notes: null,
    parseConfidence: null,
    parseRaw: null,
    order: 1,
  }],
  tags: [],
  linkedSubRecipes: [],
};

function renderModal(onClose = vi.fn()) {
  render(
    <RecipeDetailExportModal
      iterations={[]}
      onClose={onClose}
      recipe={recipe}
      servings={4}
      unitMode="cup"
    />
  );
}

describe("RecipeDetailExportModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts with the approved defaults and resets when reopened", () => {
    renderModal();
    expect(screen.getByLabelText(/export format/i)).toHaveValue("pdf");
    expect(screen.getByRole("checkbox", { name: /description/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /ingredients/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /personal and status/i })).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: /ingredients/i }));
    cleanup();
    renderModal();
    expect(screen.getByRole("checkbox", { name: /ingredients/i })).toBeChecked();
  });

  it("blocks an export when every optional group is cleared", () => {
    renderModal();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      if (checkbox instanceof HTMLInputElement && checkbox.checked) {
        fireEvent.click(checkbox);
      }
    }
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one content or metadata group/i);
  });

  it("downloads standalone HTML when the browser blocks print preview", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/export format/i), { target: { value: "print" } });
    vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recipe");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: /^print$/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/downloaded instead/i));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("adds Print and Close controls to the standalone preview", () => {
    renderModal();
    const printWindow = {
      close: vi.fn(),
      document: document.implementation.createHTMLDocument("Recipe preview"),
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(printWindow);

    fireEvent.change(screen.getByLabelText(/export format/i), { target: { value: "print" } });
    fireEvent.click(screen.getByRole("button", { name: /^print$/i }));

    const controls = printWindow.document.querySelector(".recipe-print-controls");
    expect(controls).not.toBeNull();
    expect(controls?.getAttribute("role")).toBe("toolbar");
    expect(controls?.querySelectorAll("button")).toHaveLength(2);
    expect(controls?.querySelector("button")?.textContent).toBe("Print");
    expect(controls?.querySelectorAll("button")[1]?.textContent).toBe("Close");
  });

  it("shows the live serving yield and converted ingredient amount", () => {
    renderModal();
    const preview = document.querySelector(".recipe-document");
    expect(preview?.textContent).toContain("4");
    expect(preview?.textContent).toContain("2 cup Water");
  });

  it("uses the existing Electron PDF capability", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "saved", filePath: "C:/recipe.pdf" });
    window.api = { invoke, on: vi.fn(), off: vi.fn() };
    renderModal();
    fireEvent.change(screen.getByLabelText(/export format/i), { target: { value: "pdf" } });
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      "menu:exportPdf",
      expect.objectContaining({ suggestedFileName: "test-soup.pdf" })
    ));
    window.api = undefined;
  });
});
