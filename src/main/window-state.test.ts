import { describe, expect, it } from "vitest";

import {
  captureWindowState,
  getDefaultWindowBounds,
  parsePersistedWindowState,
  resolveWindowState,
} from "./window-state";

const options = {
  defaultWidth: 1200,
  defaultHeight: 800,
  minWidth: 900,
  minHeight: 600,
};

const primaryWorkArea = { x: 0, y: 0, width: 1920, height: 1080 };

const savedState = {
  version: 1,
  bounds: { x: 100, y: 120, width: 1100, height: 700 },
  maximized: true,
};

describe("window state", () => {
  it("rejects malformed or incompatible state", () => {
    expect(parsePersistedWindowState(null)).toBeNull();
    expect(parsePersistedWindowState({ ...savedState, version: 2 })).toBeNull();
    expect(
      parsePersistedWindowState({
        ...savedState,
        bounds: { ...savedState.bounds, width: Number.NaN },
      })
    ).toBeNull();
  });

  it("restores state that intersects any display and preserves maximize state", () => {
    const result = resolveWindowState(
      { ...savedState, bounds: { ...savedState.bounds, x: 2000 } },
      [primaryWorkArea, { x: 1920, y: 0, width: 1920, height: 1080 }],
      options
    );

    expect(result).toEqual({
      bounds: { x: 2000, y: 120, width: 1100, height: 700 },
      maximized: true,
    });
  });

  it("clamps partially visible state to a usable display area", () => {
    const result = resolveWindowState(
      { ...savedState, bounds: { ...savedState.bounds, x: -1000, y: -650 } },
      [primaryWorkArea],
      options
    );

    expect(result.bounds).toEqual({
      x: -980,
      y: -650,
      width: 1100,
      height: 700,
    });
  });

  it("rejects state that is entirely off-screen", () => {
    expect(
      resolveWindowState(
        { ...savedState, bounds: { ...savedState.bounds, x: -2000 } },
        [primaryWorkArea],
        options
      )
    ).toEqual({ bounds: null, maximized: false });
  });

  it("captures normal bounds separately from maximized state", () => {
    expect(captureWindowState(savedState.bounds, true)).toEqual(savedState);
  });

  it("calculates centered defaults for reset", () => {
    expect(getDefaultWindowBounds(primaryWorkArea, options)).toEqual({
      x: 360,
      y: 140,
      width: 1200,
      height: 800,
    });
  });
});
