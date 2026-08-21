// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the title hierarchy and preserves an actions slot", () => {
    render(
      <PageHeader
        eyebrow="Recipes"
        title="Your recipes"
        subtitle="Browse your collection."
        actions={<button type="button">Add recipe</button>}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Your recipes" })).toBeInTheDocument();
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Browse your collection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add recipe" })).toBeInTheDocument();
  });
});