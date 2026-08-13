import { describe, expect, it } from "vitest";

import { QUICK_FILTERS } from "./grocery";
import {
  PREP_QUICK_FILTERS,
} from "./prep-lists";
import {
  QUICK_FILTER_ICON_KEYS,
  QUICK_FILTER_ICON_REGISTRY,
} from "./icon-registry";

describe("quick-filter icon registry", () => {
  it("resolves every declared semantic key", () => {
    expect(Object.keys(QUICK_FILTER_ICON_REGISTRY).sort()).toEqual(
      [...QUICK_FILTER_ICON_KEYS].sort()
    );

    for (const key of QUICK_FILTER_ICON_KEYS) {
      expect(QUICK_FILTER_ICON_REGISTRY[key]).toBeTypeOf("object");
    }
  });

  it("covers Grocery and Prep quick filters", () => {
    for (const filter of [...QUICK_FILTERS, ...PREP_QUICK_FILTERS]) {
      expect(QUICK_FILTER_ICON_REGISTRY[filter.icon]).toBeDefined();
    }
  });
});