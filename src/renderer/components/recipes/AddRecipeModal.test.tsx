// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/providers/toast-provider";
import { ApiError } from "@/lib/api";
import type { RecipeConflict } from "@shared/types";

import { AddRecipeModal } from "./AddRecipeModal";

const originalCrypto = globalThis.crypto;

describe("AddRecipeModal", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("renders even when crypto.randomUUID is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: vi.fn((array: Uint8Array) => {
          array.fill(7);
          return array;
        }),
      },
    });

    expect(() => {
      render(
        <ToastProvider>
          <AddRecipeModal
            onClose={() => {}}
            onSave={async () => {}}
            open={false}
          />
        </ToastProvider>
      );
    }).not.toThrow();
  });

  it("surfaces duplicate-name conflicts through onConflict", async () => {
    const conflict: RecipeConflict = {
      error: 'A recipe named "Pasta" already exists.',
      code: "RECIPE_DUPLICATE_TITLE",
      reason: "duplicate_title",
      existing: {
        id: "recipe-1",
        title: "Pasta",
        description: null,
        servings: 2,
        prepTime: null,
        cookTime: null,
        difficulty: null,
        cuisine: null,
        instructions: ["Boil water"],
        sourceUrl: null,
        sourceLabel: null,
        origin: "manual",
        favourite: false,
        rating: null,
        cookNotes: null,
        lastMadeAt: null,
        tags: [],
        ingredients: [
          {
            id: "ingredient-1",
            name: "Pasta",
            quantity: null,
            unit: null,
            group: null,
            notes: null,
            order: 0,
          },
        ],
      },
    };

    const onConflict = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError<RecipeConflict>(
          conflict.error,
          409,
          conflict.code,
          conflict
        )
      );

    render(
      <ToastProvider>
        <AddRecipeModal
          onClose={() => {}}
          onConflict={onConflict}
          onSave={onSave}
          open
        />
      </ToastProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("Weeknight Lemon Pasta"), {
      target: { value: "Pasta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Step" }));
    fireEvent.change(screen.getByPlaceholderText("Describe this step"), {
      target: { value: "Boil water" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ingredient name"), {
      target: { value: "Pasta" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Recipe" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onConflict).toHaveBeenCalledTimes(1);
    });

    expect(onConflict).toHaveBeenCalledWith(conflict);
  });

  it("focuses the recipe title input when focusTitleRequestKey changes", async () => {
    const { rerender } = render(
      <ToastProvider>
        <AddRecipeModal
          focusTitleRequestKey={0}
          onClose={() => {}}
          onSave={async () => {}}
          open
        />
      </ToastProvider>
    );

    const closeButton = screen.getAllByRole("button", { name: "Close" })[0];
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    rerender(
      <ToastProvider>
        <AddRecipeModal
          focusTitleRequestKey={1}
          onClose={() => {}}
          onSave={async () => {}}
          open
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Weeknight Lemon Pasta")
      ).toHaveFocus();
    });
  });

  it("names instruction reorder controls and preserves disabled boundaries", () => {
    render(
      <ToastProvider>
        <AddRecipeModal onClose={() => {}} onSave={async () => {}} open />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Step" }));

    const moveUp = screen.getByRole("button", {
      hidden: true,
      name: "Move step 1 up",
    });
    const moveDown = screen.getByRole("button", {
      hidden: true,
      name: "Move step 1 down",
    });

    expect(moveUp).toBeDisabled();
    expect(moveDown).toBeDisabled();
    expect(moveUp.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(moveDown.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
