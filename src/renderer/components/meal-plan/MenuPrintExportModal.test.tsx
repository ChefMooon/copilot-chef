// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MenuPrintExportModal } from "./MenuPrintExportModal";
import type { MealPayload } from "@shared/types";

const apiMocks = vi.hoisted(() => ({
  exportMenu: vi.fn(),
  fetchJson: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);

const meal: MealPayload = {
  id: "meal-1",
  name: "Pasta Night",
  date: "2026-04-01T12:00:00.000Z",
  mealType: "DINNER",
  mealTypeDefinitionId: null,
  mealTypeDefinition: null,
  notes: "Use the good parmesan",
  ingredients: [],
  description: "A weeknight pasta.",
  cuisine: null,
  instructions: [],
  servings: 2,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MenuPrintExportModal
        initialFrom={new Date("2026-04-01T00:00:00.000Z")}
        initialTo={new Date("2026-04-07T23:59:59.000Z")}
        onClose={onClose}
      />
    </QueryClientProvider>
  );

  return onClose;
}

async function waitForMenuPreview() {
  await waitFor(() => {
    expect(screen.getAllByText("Pasta Night").length).toBeGreaterThan(0);
  });
}

describe("MenuPrintExportModal", () => {
  beforeEach(() => {
    apiMocks.fetchJson.mockReset();
    apiMocks.exportMenu.mockReset();
    apiMocks.fetchJson.mockResolvedValue({ data: [meal] });
    apiMocks.exportMenu.mockResolvedValue({
      blob: new Blob(["menu"], { type: "text/html" }),
      fileName: "menu.html",
    });
    vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:menu");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(window, "open").mockReturnValue(null);
    window.api = {
      invoke: vi.fn().mockResolvedValue({ status: "saved", filePath: "C:/Users/justi/Documents/menu.pdf" }),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads and previews meals for the selected range", async () => {
    renderModal();

    await waitForMenuPreview();
    expect(apiMocks.fetchJson).toHaveBeenCalledWith(expect.stringContaining("/api/meals?from="));
  });

  it("prints the current preview", async () => {
    renderModal();

    await waitForMenuPreview();
    fireEvent.click(await screen.findByRole("button", { name: /^print$/i }));

    expect(window.print).toHaveBeenCalled();
  });

  it("prints in the current browser document", async () => {
    const printWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
        createElement: vi.fn((tagName: string) => ({
          tagName,
          addEventListener: vi.fn(),
          append: vi.fn(),
          prepend: vi.fn(),
          setAttribute: vi.fn(),
          style: {},
          textContent: "",
          type: "",
          className: "",
        })),
        head: { appendChild: vi.fn() },
        body: { prepend: vi.fn() },
        title: "",
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    } as unknown as Window;
    vi.mocked(window.open).mockReturnValue(printWindow);
    window.api = undefined;
    renderModal();

    await waitForMenuPreview();
    fireEvent.click(await screen.findByRole("button", { name: /^print$/i }));

    expect(window.open).toHaveBeenCalledWith("", "local-recipe-book-menu-print");
    expect(printWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining("Pasta Night")
    );
    expect(printWindow.focus).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(window.print).not.toHaveBeenCalled();
  });

  it("shows an error when the browser blocks the print preview", async () => {
    window.api = undefined;
    renderModal();

    await waitForMenuPreview();
    fireEvent.click(await screen.findByRole("button", { name: /^print$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /blocked the print preview/i
    );
  });

  it("shows Preview between Print and Download actions", async () => {
    renderModal();

    await waitForMenuPreview();

    const actionRow = document.querySelector(".menu-export-actions");
    expect(actionRow).toBeTruthy();
    const labels = Array.from(actionRow?.querySelectorAll("button") ?? []).map((button) =>
      button.textContent?.replace(/\s+/g, " ").trim()
    );

    expect(labels).toEqual(["Print", "Preview", "Download PDF"]);
  });

  it("renders a separate print-only menu surface", async () => {
    renderModal();

    await waitForMenuPreview();

    const printSurface = document.querySelector(".menu-export-print-surface");
    expect(printSurface).toBeTruthy();
    expect(printSurface?.getAttribute("aria-hidden")).toBe("true");
    expect(printSurface?.textContent).toContain("Pasta Night");
    expect(document.querySelectorAll(".menu-export-modal")).toHaveLength(1);
    expect(document.querySelectorAll(".menu-export-print-surface")).toHaveLength(1);
  });

  it("downloads the selected format and layout", async () => {
    renderModal();

    fireEvent.change(await screen.findByLabelText(/download format/i), {
      target: { value: "markdown" },
    });
    fireEvent.click(screen.getByRole("button", { name: /card style/i }));
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(apiMocks.exportMenu).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "markdown",
          layout: "card",
          includeEmptyDays: true,
        })
      );
    });
  });

  it("can exclude empty days from export", async () => {
    renderModal();

    fireEvent.change(await screen.findByLabelText(/download format/i), {
      target: { value: "markdown" },
    });
    const checkbox = await screen.findByRole("checkbox", {
      name: /include days without meals/i,
    });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(apiMocks.exportMenu).toHaveBeenCalledWith(
        expect.objectContaining({ includeEmptyDays: false })
      );
    });
  });

  it("exposes the selected layout and suspends the outer dialog in fullscreen preview", async () => {
    renderModal();

    await waitForMenuPreview();
    const classicGrid = screen.getByRole("button", { name: /classic grid/i });
    expect(classicGrid).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /card style/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    const outerOverlay = document.querySelector(".menu-export-modal");
    expect(outerOverlay).toHaveAttribute("aria-hidden", "true");
    expect(outerOverlay).toHaveAttribute("inert");
  });

  it("uses the system save flow when PDF is selected", async () => {
    renderModal();

    fireEvent.change(await screen.findByLabelText(/download format/i), {
      target: { value: "pdf" },
    });
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(window.api.invoke).toHaveBeenCalledWith(
        "menu:exportPdf",
        expect.objectContaining({
          suggestedFileName: expect.stringMatching(/\.pdf$/i),
        })
      );
    });
    expect(window.print).not.toHaveBeenCalled();
    expect(apiMocks.exportMenu).not.toHaveBeenCalled();
  });

  it("uses browser print as the PDF fallback when native PDF export is unavailable", async () => {
    window.api = undefined;
    renderModal();
    await waitForMenuPreview();

    const downloadButton = await screen.findByRole("button", {
      name: /print \/ save pdf/i,
    });
    expect(screen.getByRole("option", { name: /print \/ save pdf/i })).toBeTruthy();

    fireEvent.click(downloadButton);

    expect(window.open).toHaveBeenCalledWith("", "local-recipe-book-menu-print");
    expect(window.print).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(apiMocks.exportMenu).not.toHaveBeenCalled();
  });

  it("opens and closes fullscreen preview", async () => {
    renderModal();

    await waitForMenuPreview();
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    const fullscreenDialog = screen.getByRole("dialog", { name: /fullscreen menu preview/i });
    expect(fullscreenDialog).toBeTruthy();
    expect(screen.getByRole("button", { name: /exit preview/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /exit preview/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /fullscreen menu preview/i })).toBeNull();
    });
  });

  it("can print and download from fullscreen preview", async () => {
    renderModal();

    fireEvent.change(await screen.findByLabelText(/download format/i), {
      target: { value: "markdown" },
    });
    await waitForMenuPreview();

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    const fullscreenDialog = screen.getByRole("dialog", { name: /fullscreen menu preview/i });
    fireEvent.click(within(fullscreenDialog).getByRole("button", { name: /^print$/i }));
    fireEvent.click(within(fullscreenDialog).getByRole("button", { name: /^download$/i }));

    expect(window.print).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMocks.exportMenu).toHaveBeenCalledWith(
        expect.objectContaining({
          format: "markdown",
        })
      );
    });
  });

  it("uses Escape to exit fullscreen preview before closing the modal", async () => {
    const onClose = renderModal();

    await waitForMenuPreview();
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /fullscreen menu preview/i })).toBeNull();
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = renderModal();

    await waitForMenuPreview();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
