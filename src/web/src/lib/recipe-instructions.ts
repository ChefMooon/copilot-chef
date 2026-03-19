/**
 * Utilities for managing recipe instruction steps in the Add Recipe modal.
 * Handles normalization, draft-to-payload conversion, and payload-to-draft hydration.
 */

export type InstructionDraft = {
  id: string;
  text: string;
};

/**
 * Strip leading numeric prefixes from instruction text to avoid double-numbering.
 * Examples:
 * - "1. Mix flour" → "Mix flour"
 * - "2) Add water" → "Add water"
 * - "iii. Stir" → "iii. Stir" (roman numerals not matched; users responsible)
 * - "Mix gently" → "Mix gently" (no prefix)
 */
export function normalizeInstructionStep(text: string): string {
  const trimmed = text.trim();
  // Match leading numeric pattern: 1. 1) 123. 123)
  return trimmed.replace(/^\d+[.)]\s+/, "");
}

/**
 * Create a new empty instruction draft with a stable UUID.
 */
export function createEmptyInstructionDraft(): InstructionDraft {
  return {
    id: crypto.randomUUID(),
    text: "",
  };
}

/**
 * Convert instruction drafts to final payload array.
 * - Normalizes each step (strips numeric prefixes)
 * - Trims whitespace
 * - Filters out empty steps
 * @param drafts Array of instruction drafts from modal state
 * @returns Array of normalized step text strings for API submission
 */
export function instructionDraftsToPayload(drafts: InstructionDraft[]): string[] {
  return drafts
    .map((draft) => normalizeInstructionStep(draft.text))
    .filter((step) => step.length > 0);
}

/**
 * Hydrate modal instruction drafts from existing recipe instruction steps.
 * Normalizes legacy numbered steps on load to prevent double numbering on display.
 * @param steps Array of instruction step strings from a recipe
 * @returns Array of instruction drafts with stable IDs and normalized text
 */
export function payloadToInstructionDrafts(steps: string[]): InstructionDraft[] {
  return steps.map((step) => ({
    id: crypto.randomUUID(),
    text: normalizeInstructionStep(step),
  }));
}
