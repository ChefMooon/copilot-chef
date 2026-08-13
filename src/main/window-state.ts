import type { Rectangle } from "electron";

export const WINDOW_STATE_SETTING_KEY = "app_window_state";
export const WINDOW_STATE_VERSION = 1;

export type PersistedWindowState = {
  version: typeof WINDOW_STATE_VERSION;
  bounds: Rectangle;
  maximized: boolean;
};

export type WindowStateOptions = {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
};

export const DEFAULT_WINDOW_STATE_OPTIONS: WindowStateOptions = {
  defaultWidth: 1200,
  defaultHeight: 800,
  minWidth: 900,
  minHeight: 600,
};

const MIN_VISIBLE_WIDTH = 120;
const MIN_VISIBLE_HEIGHT = 48;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRectangle(value: unknown): value is Rectangle {
  if (!value || typeof value !== "object") return false;
  const rectangle = value as Partial<Rectangle>;
  return (
    isFiniteNumber(rectangle.x) &&
    isFiniteNumber(rectangle.y) &&
    isFiniteNumber(rectangle.width) &&
    isFiniteNumber(rectangle.height)
  );
}

export function parsePersistedWindowState(value: unknown): PersistedWindowState | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<PersistedWindowState>;
  if (
    candidate.version !== WINDOW_STATE_VERSION ||
    !isRectangle(candidate.bounds) ||
    candidate.bounds.width <= 0 ||
    candidate.bounds.height <= 0 ||
    typeof candidate.maximized !== "boolean"
  ) {
    return null;
  }

  return {
    version: WINDOW_STATE_VERSION,
    bounds: { ...candidate.bounds },
    maximized: candidate.maximized,
  };
}

function intersectionArea(first: Rectangle, second: Rectangle): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x)
  );
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y)
  );
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampToWorkArea(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const minX = workArea.x - bounds.width + MIN_VISIBLE_WIDTH;
  const maxX = workArea.x + workArea.width - MIN_VISIBLE_WIDTH;
  const minY = workArea.y - bounds.height + MIN_VISIBLE_HEIGHT;
  const maxY = workArea.y + workArea.height - MIN_VISIBLE_HEIGHT;

  return {
    ...bounds,
    x: clamp(bounds.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(bounds.y, Math.min(minY, maxY), Math.max(minY, maxY)),
  };
}

export function getDefaultWindowBounds(
  workArea: Rectangle,
  options: WindowStateOptions
): Rectangle {
  return {
    x: Math.round(workArea.x + (workArea.width - options.defaultWidth) / 2),
    y: Math.round(workArea.y + (workArea.height - options.defaultHeight) / 2),
    width: Math.max(options.defaultWidth, options.minWidth),
    height: Math.max(options.defaultHeight, options.minHeight),
  };
}

export function resolveWindowState(
  value: unknown,
  workAreas: Rectangle[],
  options: WindowStateOptions
): { bounds: Rectangle | null; maximized: boolean } {
  const state = parsePersistedWindowState(value);
  if (!state || workAreas.length === 0) {
    return { bounds: null, maximized: false };
  }

  const visibleWorkArea = workAreas
    .map((workArea) => ({ workArea, area: intersectionArea(state.bounds, workArea) }))
    .filter(({ area }) => area > 0)
    .sort((first, second) => second.area - first.area)[0]?.workArea;

  if (!visibleWorkArea) {
    return { bounds: null, maximized: false };
  }

  const bounds = clampToWorkArea(state.bounds, visibleWorkArea);
  return {
    bounds: {
      ...bounds,
      width: Math.max(bounds.width, options.minWidth),
      height: Math.max(bounds.height, options.minHeight),
    },
    maximized: state.maximized,
  };
}

export function captureWindowState(
  normalBounds: Rectangle,
  maximized: boolean
): PersistedWindowState {
  return {
    version: WINDOW_STATE_VERSION,
    bounds: { ...normalBounds },
    maximized,
  };
}

export function resetWindowLayout(
  window: {
    isMaximized: () => boolean;
    unmaximize: () => void;
    setBounds: (bounds: Rectangle) => void;
  },
  workArea: Rectangle,
  options: WindowStateOptions
): void {
  if (window.isMaximized()) {
    window.unmaximize();
  }
  window.setBounds(getDefaultWindowBounds(workArea, options));
}
