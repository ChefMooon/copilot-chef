import { describe, it, expect } from "vitest";
import {
  normalizeInstructionStep,
  instructionDraftsToPayload,
  payloadToInstructionDrafts,
  createEmptyInstructionDraft,
} from "./recipe-instructions";

describe("recipe-instructions", () => {
  describe("normalizeInstructionStep", () => {
    it("strips leading numeric prefix with period", () => {
      expect(normalizeInstructionStep("1. Mix flour and water")).toBe(
        "Mix flour and water"
      );
    });

    it("strips leading numeric prefix with closing paren", () => {
      expect(normalizeInstructionStep("2) Add salt")).toBe("Add salt");
    });

    it("handles multi-digit numbers", () => {
      expect(normalizeInstructionStep("123. Stir gently")).toBe("Stir gently");
    });

    it("handles multidigit with closing paren", () => {
      expect(normalizeInstructionStep("42) Cook slowly")).toBe("Cook slowly");
    });

    it("returns unchanged text if no numeric prefix", () => {
      expect(normalizeInstructionStep("Mix gently")).toBe("Mix gently");
    });

    it("trims whitespace", () => {
      expect(normalizeInstructionStep("  1. Boil pasta  ")).toBe("Boil pasta");
    });

    it("preserves text that starts with a number but no separator", () => {
      expect(normalizeInstructionStep("2 cups flour")).toBe("2 cups flour");
    });

    it("does not attempt to strip roman numerals", () => {
      expect(normalizeInstructionStep("iii. Stir the mixture")).toBe(
        "iii. Stir the mixture"
      );
    });

    it("handles empty string", () => {
      expect(normalizeInstructionStep("")).toBe("");
    });

    it("handles whitespace-only string", () => {
      expect(normalizeInstructionStep("   ")).toBe("");
    });
  });

  describe("instructionDraftsToPayload", () => {
    it("converts drafts to payload array", () => {
      const drafts = [
        { id: "1", text: "1. Mix flour" },
        { id: "2", text: "2. Add water" },
      ];
      expect(instructionDraftsToPayload(drafts)).toEqual([
        "Mix flour",
        "Add water",
      ]);
    });

    it("normalizes numbered prefixes during conversion", () => {
      const drafts = [
        { id: "1", text: "1. First step" },
        { id: "2", text: "Step two" },
      ];
      expect(instructionDraftsToPayload(drafts)).toEqual([
        "First step",
        "Step two",
      ]);
    });

    it("filters out empty steps after normalization", () => {
      const drafts = [
        { id: "1", text: "Valid step" },
        { id: "2", text: "   " },
        { id: "3", text: "Another step" },
      ];
      expect(instructionDraftsToPayload(drafts)).toEqual([
        "Valid step",
        "Another step",
      ]);
    });

    it("returns empty array when all steps are empty", () => {
      const drafts = [
        { id: "1", text: "   " },
        { id: "2", text: "" },
      ];
      expect(instructionDraftsToPayload(drafts)).toEqual([]);
    });

    it("preserves order of steps", () => {
      const drafts = [
        { id: "1", text: "Step one" },
        { id: "2", text: "Step two" },
        { id: "3", text: "Step three" },
      ];
      expect(instructionDraftsToPayload(drafts)).toEqual([
        "Step one",
        "Step two",
        "Step three",
      ]);
    });
  });

  describe("payloadToInstructionDrafts", () => {
    it("converts payload array to instruction drafts with IDs", () => {
      const steps = ["Mix ingredients", "Bake for 30 minutes"];
      const drafts = payloadToInstructionDrafts(steps);

      expect(drafts).toHaveLength(2);
      expect(drafts[0]).toEqual({
        id: expect.any(String),
        text: "Mix ingredients",
      });
      expect(drafts[1]).toEqual({
        id: expect.any(String),
        text: "Bake for 30 minutes",
      });
    });

    it("normalizes legacy numbered steps on load", () => {
      const steps = ["1. Mix flour", "2. Add water", "3. Knead dough"];
      const drafts = payloadToInstructionDrafts(steps);

      expect(drafts[0].text).toBe("Mix flour");
      expect(drafts[1].text).toBe("Add water");
      expect(drafts[2].text).toBe("Knead dough");
    });

    it("generates unique IDs for each draft", () => {
      const steps = ["Step one", "Step two"];
      const drafts = payloadToInstructionDrafts(steps);

      expect(drafts[0].id).not.toBe(drafts[1].id);
    });

    it("returns empty array for empty payload", () => {
      const drafts = payloadToInstructionDrafts([]);
      expect(drafts).toEqual([]);
    });

    it("preserves step order", () => {
      const steps = ["First", "Second", "Third"];
      const drafts = payloadToInstructionDrafts(steps);

      expect(drafts.map((d) => d.text)).toEqual(["First", "Second", "Third"]);
    });
  });

  describe("createEmptyInstructionDraft", () => {
    it("creates a draft with empty text and a UUID", () => {
      const draft = createEmptyInstructionDraft();

      expect(draft).toEqual({
        id: expect.any(String),
        text: "",
      });
    });

    it("generates different IDs on subsequent calls", () => {
      const draft1 = createEmptyInstructionDraft();
      const draft2 = createEmptyInstructionDraft();

      expect(draft1.id).not.toBe(draft2.id);
    });
  });

  describe("round-trip conversion", () => {
    it("preserves step text through draft->payload->draft cycle", () => {
      const originalSteps = ["Mix ingredients", "Bake", "Cool"];
      const drafts = payloadToInstructionDrafts(originalSteps);
      const payload = instructionDraftsToPayload(drafts);

      expect(payload).toEqual(originalSteps);
    });

    it("normalizes legacy numbered steps through round-trip", () => {
      const legacySteps = ["1. Mix", "2) Bake", "3. Cool"];
      const drafts = payloadToInstructionDrafts(legacySteps);
      const payload = instructionDraftsToPayload(drafts);

      expect(payload).toEqual(["Mix", "Bake", "Cool"]);
    });
  });
});
