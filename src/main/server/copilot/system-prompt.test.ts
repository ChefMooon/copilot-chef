import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("includes Meal Bank entries as unscheduled options", () => {
    const prompt = buildSystemPrompt({
      mealBank: [
        {
          name: "Freezer Chili",
          mealType: "bank",
          date: null,
        },
      ],
    });

    expect(prompt).toContain("## Meal Bank");
    expect(prompt).toContain("Freezer Chili");
    expect(prompt).toContain("date=null and mealType=\"bank\"");
  });
});