// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMocks = vi.hoisted(() => ({
  listMealTypeProfiles: vi.fn(),
  updateMealTypeDefinition: vi.fn(),
  createMealTypeProfile: vi.fn(),
  updateMealTypeProfile: vi.fn(),
  deleteMealTypeProfile: vi.fn(),
  duplicateMealTypeProfile: vi.fn(),
  createMealTypeDefinition: vi.fn(),
  deleteMealTypeDefinition: vi.fn(),
  reorderMealTypeDefinitions: vi.fn(),
}));

const toastMock = vi.fn();

vi.mock("@/lib/api", () => ({
  listMealTypeProfiles: apiMocks.listMealTypeProfiles,
  updateMealTypeDefinition: apiMocks.updateMealTypeDefinition,
  createMealTypeProfile: apiMocks.createMealTypeProfile,
  updateMealTypeProfile: apiMocks.updateMealTypeProfile,
  deleteMealTypeProfile: apiMocks.deleteMealTypeProfile,
  duplicateMealTypeProfile: apiMocks.duplicateMealTypeProfile,
  createMealTypeDefinition: apiMocks.createMealTypeDefinition,
  deleteMealTypeDefinition: apiMocks.deleteMealTypeDefinition,
  reorderMealTypeDefinitions: apiMocks.reorderMealTypeDefinitions,
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

import { MealTypesSection } from "./MealTypesSection";

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MealTypesSection />
    </QueryClientProvider>
  );
}

describe("MealTypesSection", () => {
  beforeEach(() => {
    toastMock.mockReset();
    localStorage.clear();

    apiMocks.listMealTypeProfiles.mockResolvedValue([
      {
        id: "profile-1",
        name: "Default",
        color: "#3B5E45",
        description: "Default meal types",
        isDefault: true,
        priority: 0,
        startDate: null,
        endDate: null,
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T00:00:00.000Z",
        mealTypes: [
          {
            id: "definition-1",
            profileId: "profile-1",
            name: "Dinner",
            slug: "DINNER",
            color: "#8FB7D4",
            enabled: true,
            sortOrder: 0,
            createdAt: "2026-04-17T00:00:00.000Z",
            updatedAt: "2026-04-17T00:00:00.000Z",
          },
        ],
      },
    ]);

    apiMocks.updateMealTypeDefinition.mockResolvedValue({
      id: "definition-1",
      profileId: "profile-1",
      name: "Dinner",
      slug: "DINNER",
      color: "#8FB7D4",
      enabled: false,
      sortOrder: 0,
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    });

    apiMocks.createMealTypeProfile.mockResolvedValue({
      id: "profile-2",
      name: "Ramadan",
      color: "#E8885A",
      description: null,
      isDefault: false,
      priority: 0,
      startDate: null,
      endDate: null,
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
      mealTypes: [],
    });
    apiMocks.updateMealTypeProfile.mockResolvedValue(null);
    apiMocks.deleteMealTypeProfile.mockResolvedValue(null);
    apiMocks.duplicateMealTypeProfile.mockResolvedValue(null);
    apiMocks.createMealTypeDefinition.mockImplementation(
      async (profileId: string, input: { name: string; color: string; enabled?: boolean }) => ({
        id: `${profileId}-${input.name.toLowerCase()}`,
        profileId,
        name: input.name,
        slug: input.name.toUpperCase(),
        color: input.color,
        enabled: input.enabled ?? true,
        sortOrder: 0,
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T00:00:00.000Z",
      })
    );
    apiMocks.deleteMealTypeDefinition.mockResolvedValue(null);
    apiMocks.reorderMealTypeDefinitions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows only the update profile action for the default profile", async () => {
    renderWithQueryClient();

    expect(await screen.findByRole("button", { name: "Update profile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit meal types" })).toBeNull();
  });

  it("keeps the update profile modal flow intact", async () => {
    renderWithQueryClient();

    fireEvent.click(await screen.findByRole("button", { name: "Update profile" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Update custom meal type profile",
    });
    const modal = within(dialog);

    expect(modal.getByDisplayValue("Default")).toBeTruthy();
    expect(modal.getByText("Meal Types")).toBeTruthy();
    expect(modal.getByDisplayValue("Dinner")).toBeTruthy();
  });

  it("shows the custom profiles empty state without edit profile actions", async () => {
    renderWithQueryClient();

    expect((await screen.findAllByText("Custom Profiles")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("No custom meal plan profiles yet.").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Add custom profile" }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull();
  });

  it("lets users add and edit meal types during custom profile creation", async () => {
    renderWithQueryClient();

    const addProfileButtons = await screen.findAllByRole("button", {
      name: "Add custom profile",
    });
    fireEvent.click(addProfileButtons[addProfileButtons.length - 1]);

    const dialog = await screen.findByRole("dialog", {
      name: "Add custom meal type profile",
    });
    const modal = within(dialog);

    fireEvent.change(modal.getByPlaceholderText("Ramadan"), {
      target: { value: "Ramadan" },
    });

    expect(modal.getByText("Meal Types")).toBeTruthy();
    expect(modal.getAllByPlaceholderText("Iftar")).toHaveLength(1);

    const initialMealTypeInputs = modal.getAllByPlaceholderText("Iftar");
    fireEvent.change(initialMealTypeInputs[0], {
      target: { value: "Dinner" },
    });

    expect(modal.getByDisplayValue("Dinner")).toBeTruthy();

    fireEvent.click(modal.getByRole("button", { name: "Add meal type" }));

    const iftarInputs = modal.getAllByPlaceholderText("Iftar");
    fireEvent.change(iftarInputs[iftarInputs.length - 1], {
      target: { value: "Iftar" },
    });

    expect(modal.getByDisplayValue("Iftar")).toBeTruthy();
    expect(modal.getAllByRole("button", { name: "Remove" }).length).toBeGreaterThan(0);

    fireEvent.click(modal.getByRole("button", { name: "Create profile" }));

    await waitFor(() => {
      expect(apiMocks.createMealTypeProfile).toHaveBeenCalledWith({
        name: "Ramadan",
        color: "#3B5E45",
        description: null,
        priority: 0,
        startDate: null,
        endDate: null,
      });
    });

    await waitFor(() => {
      expect(apiMocks.createMealTypeDefinition).toHaveBeenCalledWith("profile-2", {
        name: "Dinner",
        color: "#E8885A",
        enabled: true,
      });
      expect(apiMocks.createMealTypeDefinition).toHaveBeenCalledWith("profile-2", {
        name: "Iftar",
        color: "#E8885A",
        enabled: true,
      });
      expect(apiMocks.reorderMealTypeDefinitions).toHaveBeenCalledWith("profile-2", [
        "profile-2-dinner",
        "profile-2-iftar",
      ]);
      expect(apiMocks.updateMealTypeDefinition).toHaveBeenCalledTimes(0);
    });
  });
});