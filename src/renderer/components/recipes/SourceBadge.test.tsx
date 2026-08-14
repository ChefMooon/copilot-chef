// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SourceBadge } from "./SourceBadge";

afterEach(() => {
  cleanup();
});

describe("SourceBadge source links", () => {
  it("keeps manual recipe sources non-interactive", () => {
    render(
      <SourceBadge
        origin="manual"
        sourceLabel="My notes"
        sourceUrl="https://example.com/recipe"
      />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("My notes")).toBeInTheDocument();
  });

  it("keeps imported recipes without a source URL non-interactive", () => {
    render(<SourceBadge origin="imported" sourceLabel="Original recipe" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["http://example.com/recipe", "https://example.com/recipe"]) (
    "renders an accessible external link for imported %s sources",
    (sourceUrl) => {
      render(
        <SourceBadge
          origin="imported"
          sourceLabel="Original recipe"
          sourceUrl={sourceUrl}
        />
      );

      const link = screen.getByRole("link", {
        name: "Open original recipe: Original recipe",
      });
      expect(link).toHaveAttribute("href", sourceUrl);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "Open original recipe");
    }
  );

  it.each(["ftp://example.com/recipe", "not-a-url"]) (
    "keeps imported %s sources non-interactive",
    (sourceUrl) => {
      render(
        <SourceBadge
          origin="imported"
          sourceLabel="Original recipe"
          sourceUrl={sourceUrl}
        />
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("Original recipe")).toBeInTheDocument();
    }
  );
});
