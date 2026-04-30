import { createUuid } from "./uuid";

export type InstructionDraft = {
  id: string;
  text: string;
};

export function createEmptyInstructionDraft(): InstructionDraft {
  return { id: createUuid(), text: "" };
}

export function instructionDraftsToPayload(drafts: InstructionDraft[]): string[] {
  return drafts.map((d) => d.text).filter((t) => t.trim().length > 0);
}

export function payloadToInstructionDrafts(instructions: string[]): InstructionDraft[] {
  return instructions.map((text) => ({ id: createUuid(), text }));
}
