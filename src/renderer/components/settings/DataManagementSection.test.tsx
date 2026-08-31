// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConflictRecord,
  ExportScope,
} from "@shared/schemas/data-management-schemas";

const platformMock = vi.hoisted(() => ({
  runtime: "electron" as const,
  capabilities: { dataManagement: true },
  openDataArchive: vi.fn(),
  saveDataArchive: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  exportDataArchive: vi.fn(),
  validateDataArchive: vi.fn(),
  previewDataArchive: vi.fn(),
  applyDataArchive: vi.fn(),
}));

const invalidateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform", () => ({
  getPlatform: () => platformMock,
}));

vi.mock("@/lib/api", () => apiMocks);

vi.mock("@/lib/query-invalidation", () => ({
  invalidateDataManagementQueries: invalidateMock,
}));

import { DataManagementSection } from "./DataManagementSection";

function renderSection(
  onPreferencesRestored = vi.fn(),
  onResetPreferences?: () => Promise<void>,
  resettingPreferences = false
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DataManagementSection
        onPreferencesRestored={onPreferencesRestored}
        onResetPreferences={onResetPreferences}
        resettingPreferences={resettingPreferences}
      />
    </QueryClientProvider>
  );

  return { onPreferencesRestored };
}

function configureImport({
  conflicts = [],
  scope = "all",
}: {
  conflicts?: ConflictRecord[];
  scope?: ExportScope;
} = {}) {
  platformMock.openDataArchive.mockResolvedValue({
    status: "selected",
    filePath: "C:/backups/household.lrb",
    data: new Uint8Array([1, 2, 3]),
  });
  apiMocks.validateDataArchive.mockResolvedValue({
    valid: true,
    errors: [],
    manifest: { scope },
    counts: { entries: 6, uncompressedBytes: 2048, assets: 1 },
  });
  apiMocks.previewDataArchive.mockResolvedValue({
    valid: true,
    manifest: { scope },
    conflicts,
    summary: {
      local: { recipes: conflicts.length },
      imported: { recipes: 2, meals: 3 },
    },
    idMap: {},
    bulkDecisions: ["keep-local", "import", "skip"],
  });
  apiMocks.applyDataArchive.mockResolvedValue({
    summary: {
      mode: "merge",
      imported: 2,
      skipped: 0,
      replaced: 0,
      unresolved: 0,
      conflicts: conflicts.length,
      assets: { imported: 1, skipped: 0, failed: 0 },
      preferencesRestored: false,
    },
  });
}

describe("DataManagementSection", () => {
  beforeEach(() => {
    platformMock.capabilities.dataManagement = true;
    platformMock.openDataArchive.mockReset();
    platformMock.saveDataArchive.mockReset();
    apiMocks.exportDataArchive.mockReset();
    apiMocks.validateDataArchive.mockReset();
    apiMocks.previewDataArchive.mockReset();
    apiMocks.applyDataArchive.mockReset();
    invalidateMock.mockReset();
    invalidateMock.mockResolvedValue(undefined);
    platformMock.saveDataArchive.mockResolvedValue({
      status: "saved",
      filePath: "C:/backups/local-recipe-book-all.lrb",
    });
    apiMocks.exportDataArchive.mockResolvedValue({
      blob: new Blob(["archive"]),
      fileName: "local-recipe-book-all.lrb",
      contentType: "application/zip",
      contentLength: 7,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains the browser unsupported state without offering native controls", () => {
    platformMock.capabilities.dataManagement = false;
    const onResetPreferences = vi.fn().mockResolvedValue(undefined);

    renderSection(vi.fn(), onResetPreferences);

    expect(
      screen.getByRole("heading", {
        name: /data backup and restore requires the desktop app/i,
      })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /choose backup archive/i })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /^reset preferences$/i })
    ).toBeTruthy();
    expect(platformMock.openDataArchive).not.toHaveBeenCalled();
  });

  it("confirms preference reset and prevents duplicate pending submissions", async () => {
    const onResetPreferences = vi.fn().mockResolvedValue(undefined);

    renderSection(vi.fn(), onResetPreferences);

    fireEvent.click(screen.getByRole("button", { name: /^reset preferences$/i }));
    expect(
      screen.getByRole("alertdialog", { name: /reset preferences/i })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onResetPreferences).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^reset preferences$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm reset/i }));
    await waitFor(() => expect(onResetPreferences).toHaveBeenCalledTimes(1));

    cleanup();
    renderSection(vi.fn(), onResetPreferences, true);
    expect(
      screen.getByRole("button", { name: /resetting preferences/i })
    ).toBeDisabled();
  });

  it("shows an inline reset failure", async () => {
    const onResetPreferences = vi
      .fn()
      .mockRejectedValue(new Error("Reset failed"));

    renderSection(vi.fn(), onResetPreferences);
    fireEvent.click(screen.getByRole("button", { name: /^reset preferences$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm reset/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Reset failed");
  });

  it("shows the selected scope inclusion summary", () => {
    renderSection();

    expect(
      screen.getByText(/allowlisted preferences, never secrets/i)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /meal plan/i }));

    expect(screen.getByText(/scheduled and unscheduled meals/i)).toBeTruthy();
    expect(
      screen.getByText(/referenced recipes and meal photos/i)
    ).toBeTruthy();
    expect(
      screen.queryByText(/allowlisted preferences, never secrets/i)
    ).toBeNull();
  });

  it("supports export loading, cancellation, success, and error states", async () => {
    let resolveExport: ((value: unknown) => void) | undefined;
    apiMocks.exportDataArchive.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      })
    );

    renderSection();
    fireEvent.click(
      screen.getByRole("button", { name: /export data archive/i })
    );

    expect(
      screen.getByRole("button", { name: /creating archive/i })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /cancel export/i }));
    expect(screen.getByText(/export canceled/i)).toBeTruthy();
    resolveExport?.({
      blob: new Blob(["archive"]),
      fileName: "ignored.lrb",
      contentType: "application/zip",
      contentLength: 7,
    });
    expect(platformMock.saveDataArchive).not.toHaveBeenCalled();

    apiMocks.exportDataArchive.mockRejectedValueOnce(
      new Error("Export failed")
    );
    fireEvent.click(
      screen.getByRole("button", { name: /export data archive/i })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Export failed");
  });

  it("requires explicit merge conflict choices and honors safe bulk actions", async () => {
    configureImport({
      conflicts: [
        {
          id: "recipe-conflict-1",
          domain: "recipe",
          identity: "recipe:one",
          reason: "same-identity",
          localSummary: { title: "Local one" },
          importedSummary: { title: "Incoming one" },
        },
        {
          id: "recipe-conflict-2",
          domain: "recipe",
          identity: "recipe:two",
          reason: "same-id",
          localSummary: { title: "Local two" },
          importedSummary: { title: "Incoming two" },
        },
      ] satisfies ConflictRecord[],
    });

    renderSection();
    fireEvent.click(
      screen.getByRole("button", { name: /choose backup archive/i })
    );

    expect(await screen.findByText(/review merge conflicts/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /apply merge/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /import all/i }));
    expect(
      screen.getByRole("button", { name: /apply merge/i })
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /apply merge/i }));
    await waitFor(() => expect(invalidateMock).toHaveBeenCalled());
    expect(apiMocks.applyDataArchive).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        mode: "merge",
        bulkDecision: "import",
        decisions: [
          { conflictId: "recipe-conflict-1", decision: "import" },
          { conflictId: "recipe-conflict-2", decision: "import" },
        ],
      })
    );
    expect(screen.getByText(/import complete/i)).toBeTruthy();
  });

  it("defaults replace preferences off and confirms before applying", async () => {
    configureImport();
    apiMocks.applyDataArchive.mockResolvedValue({
      summary: {
        mode: "replace",
        imported: 4,
        skipped: 0,
        replaced: 2,
        unresolved: 0,
        conflicts: 0,
        assets: { imported: 1, skipped: 0, failed: 0 },
        preferencesRestored: true,
      },
      backupPath: "C:/backups/recovery.lrb",
    });
    const { onPreferencesRestored } = renderSection();
    fireEvent.click(
      screen.getByRole("button", { name: /choose backup archive/i })
    );
    await screen.findByText(/archive validated/i);

    fireEvent.click(
      screen.getByRole("radio", { name: /replace current content/i })
    );
    const restoreToggle = screen.getByRole("checkbox", {
      name: /restore safe preferences/i,
    });
    expect(restoreToggle).not.toBeChecked();
    fireEvent.click(restoreToggle);
    fireEvent.click(
      screen.getByRole("button", { name: /replace current data/i })
    );

    expect(
      screen.getByRole("alertdialog", { name: /replace current data/i })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /confirm replacement/i })
    );

    await waitFor(() => expect(onPreferencesRestored).toHaveBeenCalled());
    expect(apiMocks.applyDataArchive).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ mode: "replace", restorePreferences: true })
    );
    expect(screen.getByText(/recovery backup created/i)).toBeTruthy();
  });
});
