import {
  Suspense,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MealTypesSection } from "@/components/settings/MealTypesSection";
import { MealSubTypesSection } from "@/components/settings/MealSubTypesSection";

import { ChipList } from "@/components/settings/ChipList";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { SegmentedControl } from "@/components/settings/SegmentedControl";
import { TagCloud } from "@/components/settings/TagCloud";
import styles from "@/components/settings/settings.module.css";
import { ToggleSwitch } from "@/components/settings/ToggleSwitch";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  exportUserData,
  getPreferences,
  patchPreferences,
  resetPreferences,
  type SettingsPreferences,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getCachedConfig,
  isServerConfigReady,
  loadServerConfig,
  resetConfigCache,
} from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { getPlatform, type LanStatus } from "@/lib/platform";
import {
  CUISINE_OPTIONS,
  RECIPE_DEFAULT_SORT_OPTIONS,
} from "@shared/api/constants";

const preferenceQueryKey = ["preferences"] as const;

const dietaryOptions = [
  { label: "Pescatarian", value: "pescatarian" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Omnivore", value: "omnivore" },
  { label: "Keto", value: "keto" },
  { label: "Paleo", value: "paleo" },
  { label: "Gluten-free", value: "gluten-free" },
  { label: "Dairy-free", value: "dairy-free" },
  { label: "Halal", value: "halal" },
  { label: "Kosher", value: "kosher" },
];

const nutritionOptions = [
  { label: "Balanced", value: "balanced" },
  { label: "High protein", value: "high-protein" },
  { label: "Low carb", value: "low-carb" },
  { label: "Low sodium", value: "low-sodium" },
  { label: "Low calorie", value: "low-calorie" },
  { label: "Anti-inflammatory", value: "anti-inflammatory" },
  { label: "Gut health", value: "gut-health" },
  { label: "Heart-healthy", value: "heart-healthy" },
];

const cookingLengthOptions = [
  { label: "Quick (< 20 min)", value: "quick" },
  { label: "Weeknight-friendly (~30 min)", value: "weeknight" },
  { label: "Relaxed (45-60 min)", value: "relaxed" },
  { label: "Weekend projects (1 hr+)", value: "weekend" },
];

const skillOptions = [
  { label: "Beginner", value: "beginner" },
  { label: "Home cook", value: "home-cook" },
  { label: "Confident cook", value: "confident" },
  { label: "Advanced", value: "advanced" },
];

const budgetOptions = [
  { label: "Budget-friendly", value: "budget" },
  { label: "Moderate", value: "moderate" },
  { label: "Premium ok", value: "premium" },
];

const planLengthOptions = [
  { label: "3 days", value: "3" },
  { label: "7 days (week)", value: "7" },
  { label: "14 days", value: "14" },
];

const groupingOptions = [
  { label: "By category", value: "category" },
  { label: "By meal", value: "meal" },
  { label: "Alphabetical", value: "alpha" },
];

const recipeViewOptions = [
  { label: "Basic", value: "basic" },
  { label: "Annotated", value: "detailed" },
  { label: "Cooking", value: "cooking" },
];

const recipeUnitOptions = [
  { label: "Cup", value: "cup" },
  { label: "Grams", value: "grams" },
];

const homeUpcomingDetailOptions = [
  { label: "Standard", value: "standard" },
  { label: "Detailed", value: "detailed" },
];

const platform = getPlatform();

const LanQrCodeModal = lazy(async () => {
  const module = await import("@/components/settings/LanQrCodeModal");
  return { default: module.LanQrCodeModal };
});

type TabId = "dietary-profile" | "meal-plans" | "app-settings";

type HomeUpcomingDetail = "standard" | "detailed";
type MealBankPlacement = "left" | "right" | "bottom";
type RecipeDefaultSortValue = (typeof RECIPE_DEFAULT_SORT_OPTIONS)[number]["value"];

type HomeDashboardSettings = {
  upcomingDays: number;
  upcomingDetail: HomeUpcomingDetail;
  upcomingCompact: boolean;
  showUpcomingMeals: boolean;
  showMealActivity: boolean;
  showGroceryList: boolean;
  showGreetingSubtitle: boolean;
};

const HOME_DASHBOARD_DEFAULTS: HomeDashboardSettings = {
  upcomingDays: 7,
  upcomingDetail: "standard",
  upcomingCompact: false,
  showUpcomingMeals: true,
  showMealActivity: true,
  showGroceryList: true,
  showGreetingSubtitle: true,
};

const mealBankPlacementOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Bottom", value: "bottom" },
];

const DEFAULT_RECIPE_DEFAULT_SORT: RecipeDefaultSortValue = "updated_desc";

function normalizeMealBankPlacement(input: unknown): MealBankPlacement {
  return input === "left" || input === "bottom" ? input : "right";
}

function normalizeRecipeDefaultSort(input: unknown): RecipeDefaultSortValue {
  const value = typeof input === "string" ? input : "";
  return RECIPE_DEFAULT_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as RecipeDefaultSortValue)
    : DEFAULT_RECIPE_DEFAULT_SORT;
}

function clampHomeUpcomingDays(input: unknown) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return HOME_DASHBOARD_DEFAULTS.upcomingDays;
  }

  return Math.min(30, Math.max(1, Math.floor(input)));
}

function normalizeHomeDetail(input: unknown): HomeUpcomingDetail {
  return input === "detailed" ? "detailed" : "standard";
}

function normalizeHomeBool(input: unknown, fallback: boolean) {
  return typeof input === "boolean" ? input : fallback;
}

const TABS: Array<{ id: TabId; label: string; panelId: string }> = [
  {
    id: "dietary-profile",
    label: "Dietary Profile",
    panelId: "panel-dietary-profile",
  },
  { id: "meal-plans", label: "Meal Plans", panelId: "panel-meal-plans" },
  { id: "app-settings", label: "App Settings", panelId: "panel-app-settings" },
];

const TAB_IDS = TABS.map((t) => t.id);

type ArrayPreferenceField =
  | "dietaryTags"
  | "favoriteCuisines"
  | "avoidCuisines"
  | "avoidIngredients"
  | "pantryStaples"
  | "nutritionTags";

function ToggleRow(props: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleLabel}>{props.label}</div>
        <div className={styles.toggleDescription}>{props.description}</div>
      </div>
      <ToggleSwitch checked={props.checked} onChange={props.onChange} />
    </div>
  );
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function mergePreferences(
  current: SettingsPreferences,
  patch: Partial<SettingsPreferences>
) {
  return {
    ...current,
    ...patch,
  };
}

function clearBrowserTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export default function SettingsPage() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const patchMutation = useMutation({ mutationFn: patchPreferences });
  const resetMutation = useMutation({ mutationFn: resetPreferences });

  const preferencesQuery = useQuery({
    queryKey: preferenceQueryKey,
    enabled: apiReady,
    queryFn: getPreferences,
  });

  const preferences = preferencesQuery.data;

  const householdTimerRef = useRef<number | null>(null);
  const notesTimerRef = useRef<number | null>(null);

  const [householdSizeDraft, setHouseholdSizeDraft] = useState(2);
  const [householdSizeDirty, setHouseholdSizeDirty] = useState(false);
  const [householdScheduled, setHouseholdScheduled] = useState(false);
  const [planningNotesDraft, setPlanningNotesDraft] = useState("");
  const [planningNotesDirty, setPlanningNotesDirty] = useState(false);
  const [notesScheduled, setNotesScheduled] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState(false);

  // Connection section state
  const [connectionDraft, setConnectionDraft] = useState<{
    serverUrl: string;
    token: string;
    mode: "local" | "remote";
  }>({
    serverUrl: "http://localhost:3001",
    token: "",
    mode: "local",
  });
  const [machineApiKeyDraft, setMachineApiKeyDraft] = useState("");
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [updatesCheckOnStartup, setUpdatesCheckOnStartup] = useState(true);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [manualUpdateCheckPending, setManualUpdateCheckPending] =
    useState(false);
  const [lanStatus, setLanStatus] = useState<LanStatus | null>(null);
  const [lanEnabledDraft, setLanEnabledDraft] = useState(false);
  const [lanWebEnabledDraft, setLanWebEnabledDraft] = useState(false);
  const [lanAdvertisedHostDraft, setLanAdvertisedHostDraft] = useState("");
  const [lanSaving, setLanSaving] = useState(false);
  const [lanQrModalOpen, setLanQrModalOpen] = useState(false);
  const [mealBankPlacement, setMealBankPlacement] =
    useState<MealBankPlacement>("right");
  const [recipeDefaultSort, setRecipeDefaultSort] =
    useState<RecipeDefaultSortValue>(DEFAULT_RECIPE_DEFAULT_SORT);
  const [homeDashboard, setHomeDashboard] = useState<HomeDashboardSettings>(
    HOME_DASHBOARD_DEFAULTS
  );

  // Tab navigation
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const normalizeLanAdvertisedHostDraft = (
    advertisedHost: string,
    candidates: LanStatus["candidates"]
  ) => {
    const trimmed = advertisedHost.trim();
    const fallback = candidates[0]?.address ?? trimmed;

    if (!trimmed || trimmed === "127.0.0.1" || trimmed === "localhost") {
      return fallback;
    }

    if (
      candidates.length > 0 &&
      !candidates.some((candidate) => candidate.address === trimmed)
    ) {
      return fallback;
    }

    return trimmed;
  };

  function getInitialTab(): TabId {
    try {
      const stored = window.localStorage.getItem("settings-active-tab");
      if (stored && (TAB_IDS as string[]).includes(stored))
        return stored as TabId;
    } catch {
      // ignore storage failures
    }
    return "dietary-profile";
  }

  const [activeTab, setActiveTabState] = useState<TabId>(getInitialTab);

  function setActiveTab(id: TabId) {
    setActiveTabState(id);
    try {
      window.localStorage.setItem("settings-active-tab", id);
    } catch {
      // ignore storage failures
    }
  }

  function handleTabKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      setActiveTab(TABS[next].id);
      tabRefs.current[next]?.focus();
    }
  }

  // Load connection config on mount
  useEffect(() => {
    const cached = getCachedConfig();
    if (cached) {
      setConnectionDraft({
        serverUrl: cached.url,
        token: cached.token,
        mode: cached.mode,
      });
      return;
    }

    loadServerConfig()
      .then((config) => {
        setConnectionDraft({
          serverUrl: config.url,
          token: config.token,
          mode: config.mode,
        });
      })
      .catch(() => {
        // defaults already set
      });
  }, []);

  useEffect(() => {
    platform
      .getSetting("machine_api_key")
      .then((value) => {
        if (typeof value === "string") {
          setMachineApiKeyDraft(value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!platform.capabilities.lanManagement) {
      return;
    }

    platform
      .getLanStatus()
      .then((status) => {
        if (!status) return;
        const advertisedHost = normalizeLanAdvertisedHostDraft(
          status.api.advertisedHost,
          status.candidates
        );
        setLanStatus(status);
        setLanEnabledDraft(status.lanEnabled);
        setLanWebEnabledDraft(status.web.enabled);
        setLanAdvertisedHostDraft(advertisedHost);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    platform
      .getSetting("updates_check_on_startup")
      .then((value) => {
        if (typeof value === "boolean") {
          setUpdatesCheckOnStartup(value);
          return;
        }
        setUpdatesCheckOnStartup(true);
      })
      .catch(() => {
        setUpdatesCheckOnStartup(true);
      });
  }, []);

  useEffect(() => {
    Promise.all([
      platform.getSetting("meal_bank_sidecar_placement"),
      platform.getSetting("recipe_default_sort"),
      platform.getSetting("home_upcoming_days"),
      platform.getSetting("home_upcoming_detail"),
      platform.getSetting("home_upcoming_compact"),
      platform.getSetting("home_show_upcoming_meals"),
      platform.getSetting("home_show_meal_activity"),
      platform.getSetting("home_show_grocery_list"),
      platform.getSetting("home_show_greeting_subtitle"),
    ])
      .then(
        ([
          mealBankPlacementSetting,
          recipeDefaultSortSetting,
          upcomingDays,
          upcomingDetail,
          upcomingCompact,
          showUpcomingMeals,
          showMealActivity,
          showGroceryList,
          showGreetingSubtitle,
        ]) => {
          setMealBankPlacement(
            normalizeMealBankPlacement(mealBankPlacementSetting)
          );
          setRecipeDefaultSort(
            normalizeRecipeDefaultSort(recipeDefaultSortSetting)
          );
          setHomeDashboard({
            upcomingDays: clampHomeUpcomingDays(upcomingDays),
            upcomingDetail: normalizeHomeDetail(upcomingDetail),
            upcomingCompact: normalizeHomeBool(
              upcomingCompact,
              HOME_DASHBOARD_DEFAULTS.upcomingCompact
            ),
            showUpcomingMeals: normalizeHomeBool(
              showUpcomingMeals,
              HOME_DASHBOARD_DEFAULTS.showUpcomingMeals
            ),
            showMealActivity: normalizeHomeBool(
              showMealActivity,
              HOME_DASHBOARD_DEFAULTS.showMealActivity
            ),
            showGroceryList: normalizeHomeBool(
              showGroceryList,
              HOME_DASHBOARD_DEFAULTS.showGroceryList
            ),
            showGreetingSubtitle: normalizeHomeBool(
              showGreetingSubtitle,
              HOME_DASHBOARD_DEFAULTS.showGreetingSubtitle
            ),
          });
        }
      )
      .catch(() => {
        setRecipeDefaultSort(DEFAULT_RECIPE_DEFAULT_SORT);
        setHomeDashboard(HOME_DASHBOARD_DEFAULTS);
      });
  }, []);

  useEffect(() => {
    const handleUpdateAvailable = (...args: unknown[]) => {
      const info = args[0] as { version?: string } | undefined;
      if (!manualUpdateCheckPending) {
        return;
      }
      setManualUpdateCheckPending(false);
      setCheckingForUpdates(false);
      toast({
        title: "Update available",
        description: info?.version
          ? `Version ${info.version} is available to download.`
          : "A new version is available to download.",
      });
    };

    const handleUpdateNotAvailable = () => {
      if (!manualUpdateCheckPending) {
        return;
      }
      setManualUpdateCheckPending(false);
      setCheckingForUpdates(false);
      toast({ title: "You are up to date." });
    };

    const handleUpdateError = (...args: unknown[]) => {
      const message = args[0] as string | undefined;
      if (!manualUpdateCheckPending) {
        return;
      }
      setManualUpdateCheckPending(false);
      setCheckingForUpdates(false);
      toast({
        title: "Update check failed",
        description: message || "Could not check for updates right now.",
        variant: "error",
      });
    };

    return platform.subscribeUpdates({
      onAvailable: handleUpdateAvailable,
      onNotAvailable: handleUpdateNotAvailable,
      onError: handleUpdateError,
    });
  }, [manualUpdateCheckPending, toast]);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    if (!householdSizeDirty) {
      setHouseholdSizeDraft(preferences.householdSize);
    }

    if (!planningNotesDirty) {
      setPlanningNotesDraft(preferences.planningNotes);
    }
  }, [preferences, householdSizeDirty, planningNotesDirty]);

  useEffect(() => {
    return () => {
      clearBrowserTimer(householdTimerRef);
      clearBrowserTimer(notesTimerRef);
    };
  }, []);

  const saveState = useMemo(() => {
    if (pendingSaves > 0 || householdScheduled || notesScheduled) {
      return { label: "Saving…", className: styles.autosaveSaving };
    }

    if (saveError) {
      return { label: "Failed to save", className: styles.autosaveError };
    }

    return { label: "All changes saved", className: styles.autosaveSaved };
  }, [householdScheduled, notesScheduled, pendingSaves, saveError]);

  async function commitPatch(
    patch: Partial<SettingsPreferences>,
    optimistic = true
  ) {
    if (!preferences) {
      return null;
    }

    const previous =
      queryClient.getQueryData<SettingsPreferences>(preferenceQueryKey) ??
      preferences;
    if (optimistic) {
      queryClient.setQueryData<SettingsPreferences>(
        preferenceQueryKey,
        mergePreferences(previous, patch)
      );
    }

    setSaveError(false);
    setPendingSaves((count) => count + 1);

    try {
      const next = await patchMutation.mutateAsync(patch);
      queryClient.setQueryData(preferenceQueryKey, next);
      return next;
    } catch (error) {
      if (optimistic) {
        queryClient.setQueryData(preferenceQueryKey, previous);
      }
      setSaveError(true);
      throw error;
    } finally {
      setPendingSaves((count) => Math.max(0, count - 1));
    }
  }

  const scheduleHouseholdSave = (value: number) => {
    setHouseholdSizeDraft(value);
    setHouseholdSizeDirty(true);
    setHouseholdScheduled(true);
    setSaveError(false);
    clearBrowserTimer(householdTimerRef);
    householdTimerRef.current = window.setTimeout(async () => {
      setHouseholdScheduled(false);
      try {
        await commitPatch({ householdSize: value }, false);
        setHouseholdSizeDirty(false);
      } catch {
        // pill handles autosave errors
      }
    }, 600);
  };

  const scheduleNotesSave = (value: string) => {
    setPlanningNotesDraft(value);
    setPlanningNotesDirty(true);
    setNotesScheduled(true);
    setSaveError(false);
    clearBrowserTimer(notesTimerRef);
    notesTimerRef.current = window.setTimeout(async () => {
      setNotesScheduled(false);
      try {
        await commitPatch({ planningNotes: value }, false);
        setPlanningNotesDirty(false);
      } catch {
        // pill handles autosave errors
      }
    }, 600);
  };

  const handleImmediateArrayToggle = async (
    field: ArrayPreferenceField,
    value: string
  ) => {
    if (!preferences) {
      return;
    }
    await commitPatch({
      [field]: toggleValue(preferences[field], value),
    } as Partial<SettingsPreferences>);
  };

  const handleCuisineToggle = async (
    group: "favoriteCuisines" | "avoidCuisines",
    value: string
  ) => {
    if (!preferences) {
      return;
    }

    const favorites = [...preferences.favoriteCuisines];
    const avoids = [...preferences.avoidCuisines];
    const target = group === "favoriteCuisines" ? favorites : avoids;
    const other = group === "favoriteCuisines" ? avoids : favorites;
    const nextTarget = target.includes(value)
      ? target.filter((entry) => entry !== value)
      : [...target, value];
    const nextOther = other.filter((entry) => entry !== value);

    await commitPatch(
      group === "favoriteCuisines"
        ? { favoriteCuisines: nextTarget, avoidCuisines: nextOther }
        : { favoriteCuisines: nextOther, avoidCuisines: nextTarget }
    );
  };

  const handleChipAdd = async (
    field: "avoidIngredients" | "pantryStaples",
    values: string[]
  ) => {
    if (!preferences) {
      return;
    }

    const merged = [...preferences[field]];
    values.forEach((value) => {
      if (
        !merged.some((entry) => entry.toLowerCase() === value.toLowerCase())
      ) {
        merged.push(value);
      }
    });

    await commitPatch({ [field]: merged } as Partial<SettingsPreferences>);
  };

  const handleChipRemove = async (
    field: "avoidIngredients" | "pantryStaples",
    value: string
  ) => {
    if (!preferences) {
      return;
    }

    await commitPatch({
      [field]: preferences[field].filter((entry) => entry !== value),
    } as Partial<SettingsPreferences>);
  };

  const handleChipReorder = async (
    field: "avoidIngredients" | "pantryStaples",
    values: string[]
  ) => {
    await commitPatch({ [field]: values } as Partial<SettingsPreferences>);
  };

  const handleImmediateField = async <K extends keyof SettingsPreferences>(
    field: K,
    value: SettingsPreferences[K]
  ) => {
    await commitPatch({ [field]: value } as Partial<SettingsPreferences>);
  };

  const handleExport = async () => {
    try {
      const { blob, fileName } = await exportUserData();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Could not export your data.", variant: "error" });
    }
  };

  const handleReset = async () => {
    try {
      clearBrowserTimer(householdTimerRef);
      clearBrowserTimer(notesTimerRef);
      setHouseholdScheduled(false);
      setNotesScheduled(false);
      setHouseholdSizeDirty(false);
      setPlanningNotesDirty(false);
      const next = await resetMutation.mutateAsync();
      queryClient.setQueryData(preferenceQueryKey, next);
      await queryClient.invalidateQueries({ queryKey: preferenceQueryKey });
      setSaveError(false);
    } catch {
      toast({ title: "Could not reset preferences.", variant: "error" });
    }
  };

  const handleSaveConnection = async () => {
    setConnectionSaving(true);
    try {
      await platform.setSetting("remote_server_url", connectionDraft.serverUrl);
      await platform.setSetting("remote_api_key", connectionDraft.token);
      await platform.setSetting("server_mode", connectionDraft.mode);
      await platform.setSetting("machine_api_key", machineApiKeyDraft);
      resetConfigCache();
      await loadServerConfig();
      queryClient.clear();
      setConnectionSaved(true);
      window.setTimeout(() => setConnectionSaved(false), 2000);
      toast({ title: "Connection settings saved." });
    } catch {
      toast({ title: "Could not save connection settings.", variant: "error" });
    } finally {
      setConnectionSaving(false);
    }
  };

  const refreshLanStatus = async () => {
    if (!platform.capabilities.lanManagement) return;
    const status = await platform.getLanStatus();
    if (!status) return;
    const advertisedHost = normalizeLanAdvertisedHostDraft(
      status.api.advertisedHost,
      status.candidates
    );
    setLanStatus(status);
    setLanEnabledDraft(status.lanEnabled);
    setLanWebEnabledDraft(status.web.enabled);
    setLanAdvertisedHostDraft(advertisedHost);
  };

  const handleSaveLanSettings = async () => {
    setLanSaving(true);
    try {
      const nextAdvertisedHost = normalizeLanAdvertisedHostDraft(
        lanAdvertisedHostDraft,
        lanStatus?.candidates ?? []
      );
      await platform.setSetting("lan_enabled", lanEnabledDraft);
      await platform.setSetting("lan_web_enabled", lanWebEnabledDraft);
      if (nextAdvertisedHost) {
        await platform.setSetting(
          "lan_advertised_host",
          nextAdvertisedHost
        );
      }
      await platform.restartLanServices();
      await refreshLanStatus();
      toast({ title: "LAN settings saved." });
    } catch {
      toast({ title: "Could not save LAN settings.", variant: "error" });
    } finally {
      setLanSaving(false);
    }
  };

  const handleMealBankPlacementChange = async (value: string) => {
    const nextPlacement = normalizeMealBankPlacement(value);
    setMealBankPlacement(nextPlacement);

    try {
      await platform.setSetting("meal_bank_sidecar_placement", nextPlacement);
      toast({ title: "Meal Bank placement saved." });
    } catch {
      toast({ title: "Could not save Meal Bank placement.", variant: "error" });
    }
  };

  const handleRecipeDefaultSortChange = async (value: string) => {
    const nextValue = normalizeRecipeDefaultSort(value);
    const previous = recipeDefaultSort;
    setRecipeDefaultSort(nextValue);

    try {
      await platform.setSetting("recipe_default_sort", nextValue);
      toast({ title: "Recipe sort default saved." });
    } catch {
      setRecipeDefaultSort(previous);
      toast({
        title: "Could not save recipe sort default.",
        variant: "error",
      });
    }
  };

  const handleGenerateMachineToken = async () => {
    try {
      const result = await platform.generateMachineToken();
      setMachineApiKeyDraft(result.token);
      setLanQrModalOpen(false);
      await refreshLanStatus();
      toast({ title: "Machine token generated." });
    } catch {
      toast({ title: "Could not generate token.", variant: "error" });
    }
  };

  const handleRotateMachineToken = async () => {
    const confirmed = window.confirm(
      "Rotate the browser access token? Existing browser bookmarks and saved devices will need to reconnect with the new QR code or connection link."
    );
    if (!confirmed) return;

    try {
      const result = await platform.rotateMachineToken();
      setMachineApiKeyDraft(result.token);
      await refreshLanStatus();
      setLanQrModalOpen(true);
      toast({ title: "Browser access token rotated." });
    } catch {
      toast({ title: "Could not rotate token.", variant: "error" });
    }
  };

  const browserConnectionUrl =
    lanStatus?.web.url && lanStatus?.api.url && machineApiKeyDraft
      ? `${lanStatus.web.url}/connect#api=${encodeURIComponent(lanStatus.api.url)}&token=${encodeURIComponent(machineApiKeyDraft)}`
      : "";

  const canShowLanQrCode = Boolean(
    lanEnabledDraft &&
    lanWebEnabledDraft &&
    lanStatus?.api.url &&
    lanStatus?.web.url &&
    machineApiKeyDraft &&
    browserConnectionUrl
  );

  const handleToggleStartupUpdateCheck = async (checked: boolean) => {
    const previous = updatesCheckOnStartup;
    setUpdatesCheckOnStartup(checked);

    try {
      await platform.setSetting("updates_check_on_startup", checked);
    } catch {
      setUpdatesCheckOnStartup(previous);
      toast({
        title: "Could not save update check preference.",
        variant: "error",
      });
    }
  };

  const saveHomeSetting = async <K extends keyof HomeDashboardSettings>(
    key: K,
    value: HomeDashboardSettings[K],
    settingKey: string,
    normalize?: (input: HomeDashboardSettings[K]) => HomeDashboardSettings[K]
  ) => {
    const nextValue = normalize ? normalize(value) : value;
    const previous = homeDashboard[key];

    setHomeDashboard((prev) => ({
      ...prev,
      [key]: nextValue,
    }));

    try {
      await platform.setSetting(settingKey, nextValue);
    } catch {
      setHomeDashboard((prev) => ({
        ...prev,
        [key]: previous,
      }));
      toast({
        title: "Could not save Home Dashboard setting.",
        variant: "error",
      });
    }
  };

  const handleHomeUpcomingDays = async (value: number) => {
    await saveHomeSetting(
      "upcomingDays",
      value,
      "home_upcoming_days",
      (input) => clampHomeUpcomingDays(input)
    );
  };

  const handleHomeDetail = async (value: string) => {
    await saveHomeSetting(
      "upcomingDetail",
      normalizeHomeDetail(value),
      "home_upcoming_detail"
    );
  };

  const handleHomeToggle = async (
    key: keyof Pick<
      HomeDashboardSettings,
      | "upcomingCompact"
      | "showUpcomingMeals"
      | "showMealActivity"
      | "showGroceryList"
      | "showGreetingSubtitle"
    >,
    value: boolean,
    settingKey: string
  ) => {
    await saveHomeSetting(key, value, settingKey);
  };

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true);
    setManualUpdateCheckPending(true);

    try {
      const result = await platform.checkForUpdates();
      if (result === null) {
        setManualUpdateCheckPending(false);
        setCheckingForUpdates(false);
        toast({
          title: "Update check failed",
          description: "Could not check for updates right now.",
          variant: "error",
        });
      }
    } catch {
      setManualUpdateCheckPending(false);
      setCheckingForUpdates(false);
      toast({
        title: "Update check failed",
        description: "Could not check for updates right now.",
        variant: "error",
      });
    }
  };

  if (!preferences) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>Settings</div>
            <h1 className={styles.pageTitle}>Household preferences</h1>
            <p className={styles.pageSubtitle}>
              Loading your cooking profile and app defaults.
            </p>
          </div>
        </div>
        <div className={cn(styles.card, styles.loadingCard)}>
          {preferencesQuery.isError
            ? "Unable to load settings right now."
            : "Loading preferences…"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Settings</div>
          <h1 className={styles.pageTitle}>Household preferences</h1>
          <p className={styles.pageSubtitle}>
            Tune dietary direction, planning behavior, and the defaults Local
            Recipe Book uses across your kitchen workflow.
          </p>
        </div>
        <div className={cn(styles.autosavePill, saveState.className)}>
          {saveState.label}
        </div>
      </header>

      {/* ── Tab strip ── */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className={styles.tabStrip}
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={tab.panelId}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={cn(
              styles.tabButton,
              activeTab === tab.id && styles.tabButtonActive
            )}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 2: Meal Plans ── */}
      <div
        id="panel-meal-plans"
        role="tabpanel"
        aria-labelledby="meal-plans"
        hidden={activeTab !== "meal-plans"}
        className={styles.tabPanel}
      >
        <p className={styles.tabDescription}>
          Manage meal-plan profiles for different routines or seasons.
        </p>
        <MealTypesSection />
        <MealSubTypesSection />
      </div>

      {/* ── Tab 1: Dietary Profile ── */}
      <div
        id="panel-dietary-profile"
        role="tabpanel"
        aria-labelledby="dietary-profile"
        hidden={activeTab !== "dietary-profile"}
        className={styles.tabPanel}
      >
        <p className={styles.tabDescription}>
          Set your household, dietary needs, cuisines, pantry defaults, and
          nutrition goals.
        </p>
        <CollapsibleSection id="dietary-tab" label="Dietary Profile">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Household</h2>
            </div>
            <div className={styles.twoColumn}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Household size</label>
                <div className={styles.rangeRow}>
                  <input
                    className={styles.rangeInput}
                    max={8}
                    min={1}
                    onChange={(event) =>
                      scheduleHouseholdSave(Number(event.target.value))
                    }
                    step={1}
                    type="range"
                    value={householdSizeDraft}
                  />
                  <div className={styles.rangeValue}>{householdSizeDraft}</div>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Preferred cooking length
                </label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleImmediateField(
                      "cookingLength",
                      event.target.value
                    )
                  }
                  value={preferences.cookingLength}
                >
                  {cookingLengthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Dietary direction</h2>
            </div>
            <TagCloud
              onToggle={(value) =>
                void handleImmediateArrayToggle("dietaryTags", value)
              }
              options={dietaryOptions}
              selectedValues={preferences.dietaryTags}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Cuisines</h2>
            </div>
            <div className={styles.cuisineColumns}>
              <div className={styles.cuisineColumn}>
                <div className={styles.columnHeading}>Favorites</div>
                <TagCloud
                  onToggle={(value) =>
                    void handleCuisineToggle("favoriteCuisines", value)
                  }
                  options={CUISINE_OPTIONS}
                  selectedValues={preferences.favoriteCuisines}
                  tone="orange"
                />
              </div>
              <div className={styles.cuisineColumn}>
                <div className={styles.columnHeading}>Avoid</div>
                <TagCloud
                  onToggle={(value) =>
                    void handleCuisineToggle("avoidCuisines", value)
                  }
                  options={CUISINE_OPTIONS}
                  selectedValues={preferences.avoidCuisines}
                  tone="red"
                />
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.chipColumns}>
              <ChipList
                description="Allergies or hard avoidances. Drag to reprioritize."
                items={preferences.avoidIngredients}
                onAdd={(values) =>
                  void handleChipAdd("avoidIngredients", values)
                }
                onRemove={(value) =>
                  void handleChipRemove("avoidIngredients", value)
                }
                onReorder={(values) =>
                  void handleChipReorder("avoidIngredients", values)
                }
                placeholder="e.g. peanuts, shellfish"
                title="Avoid ingredients"
              />
              <ChipList
                description="Always in stock - skip from grocery lists. Drag to reorder."
                items={preferences.pantryStaples}
                onAdd={(values) => void handleChipAdd("pantryStaples", values)}
                onRemove={(value) =>
                  void handleChipRemove("pantryStaples", value)
                }
                onReorder={(values) =>
                  void handleChipReorder("pantryStaples", values)
                }
                placeholder="e.g. olive oil, garlic"
                title="Pantry staples"
              />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Planning notes</h2>
              <p className={styles.cardDescription}>
                Free-form context the AI uses when generating plans.
              </p>
            </div>
            <textarea
              className={styles.textarea}
              onChange={(event) => scheduleNotesSave(event.target.value)}
              value={planningNotesDraft}
            />
          </div>
        </CollapsibleSection>
        <CollapsibleSection id="nutrition" label="Nutrition & Goals">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Nutrition focus</h2>
            </div>
            <TagCloud
              onToggle={(value) =>
                void handleImmediateArrayToggle("nutritionTags", value)
              }
              options={nutritionOptions}
              selectedValues={preferences.nutritionTags}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Skill & budget</h2>
            </div>
            <div className={styles.twoColumn}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Cooking skill level</label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleImmediateField("skillLevel", event.target.value)
                  }
                  value={preferences.skillLevel}
                >
                  {skillOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Budget range</label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleImmediateField("budgetRange", event.target.value)
                  }
                  value={preferences.budgetRange}
                >
                  {budgetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* ── Tab 3: App Settings ── */}
      <div
        id="panel-app-settings"
        role="tabpanel"
        aria-labelledby="app-settings"
        hidden={activeTab !== "app-settings"}
        className={styles.tabPanel}
      >
        <p className={styles.tabDescription}>
          Configure connection details, automation access, app behavior,
          planning defaults, and privacy controls.
        </p>
        <CollapsibleSection id="meal-bank" label="Meal Bank">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Meal Bank sidecar</h2>
              <p className={styles.cardDescription}>
                Choose where unscheduled meals appear on the Meal Plan page.
                This preference is saved per device, including browser and iPad sessions.
              </p>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Sidecar placement</label>
              <SegmentedControl
                onChange={(value) => {
                  void handleMealBankPlacementChange(value);
                }}
                options={mealBankPlacementOptions}
                value={mealBankPlacement}
              />
              <p className={styles.fieldHint}>
                Bottom placement is usually best on tablets and narrow screens.
              </p>
            </div>
            <div className={styles.fieldGroup} style={{ marginTop: "1rem" }}>
              <label className={styles.fieldLabel}>
                Recipe library default sort
              </label>
              <select
                className={styles.select}
                onChange={(event) =>
                  void handleRecipeDefaultSortChange(event.target.value)
                }
                value={recipeDefaultSort}
              >
                {RECIPE_DEFAULT_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={styles.fieldHint}>
                Applied on Recipes when there is no active session sort override.
              </p>
            </div>
          </div>
        </CollapsibleSection>
        <CollapsibleSection id="connection" label="Connection">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Server connection</h2>
              <p className={styles.cardDescription}>
                Configure the app server URL and authentication.
              </p>
            </div>
            <div className={styles.toggleList} style={{ marginBottom: "1rem" }}>
              <ToggleRow
                checked={connectionDraft.mode === "remote"}
                label="Remote mode"
                description="Connect to a remote app server instead of the built-in one."
                onChange={(checked) =>
                  setConnectionDraft((prev) => ({
                    ...prev,
                    mode: checked ? "remote" : "local",
                  }))
                }
              />
              <ToggleRow
                checked={updatesCheckOnStartup}
                label="Check for updates at startup"
                description="Automatically check for app updates on launch (packaged app only)."
                onChange={(checked) =>
                  void handleToggleStartupUpdateCheck(checked)
                }
              />
            </div>
            {connectionDraft.mode === "remote" && (
              <div className={styles.twoColumn}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Server URL</label>
                  <input
                    className={styles.select}
                    type="text"
                    value={connectionDraft.serverUrl}
                    onChange={(event) =>
                      setConnectionDraft((prev) => ({
                        ...prev,
                        serverUrl: event.target.value,
                      }))
                    }
                    placeholder="http://localhost:3001"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Auth token</label>
                  <input
                    className={styles.select}
                    type="password"
                    value={connectionDraft.token}
                    onChange={(event) =>
                      setConnectionDraft((prev) => ({
                        ...prev,
                        token: event.target.value,
                      }))
                    }
                    placeholder="Leave blank if not required"
                  />
                </div>
              </div>
            )}
            <div className={styles.fieldGroup} style={{ marginTop: "1rem" }}>
              <label className={styles.fieldLabel}>Machine API key</label>
              <input
                className={styles.select}
                type="password"
                value={machineApiKeyDraft}
                onChange={(event) => setMachineApiKeyDraft(event.target.value)}
                placeholder="Token for external PA / automation access"
              />
            </div>
            {platform.capabilities.lanManagement && (
              <div style={{ marginTop: "1rem" }}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>LAN browser access</h3>
                  <p className={styles.cardDescription}>
                    Share the browser UI with trusted devices on this network.
                  </p>
                </div>
                <div className={styles.toggleList}>
                  <ToggleRow
                    checked={lanEnabledDraft}
                    description="Bind the API to the LAN instead of loopback only."
                    label="Enable LAN API"
                    onChange={setLanEnabledDraft}
                  />
                  <ToggleRow
                    checked={lanWebEnabledDraft}
                    description="Serve the browser UI from a separate static web server."
                    label="Enable browser UI server"
                    onChange={setLanWebEnabledDraft}
                  />
                </div>
                <div
                  className={`${styles.twoColumn} ${styles.topAlignedTwoColumn}`}
                  style={{ marginTop: "1rem" }}
                >
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>API URL</label>
                    <input
                      className={styles.select}
                      readOnly
                      value={lanStatus?.api.url ?? "Unavailable"}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Browser URL</label>
                    <input
                      className={styles.select}
                      readOnly
                      value={lanStatus?.web.url ?? "Unavailable"}
                    />
                    <p className={styles.fieldHint}>
                      Bookmark this after connecting once. The saved browser
                      token keeps trusted devices signed in.
                    </p>
                  </div>
                </div>
                <div
                  className={styles.fieldGroup}
                  style={{ marginTop: "1rem" }}
                >
                  <label className={styles.fieldLabel}>Advertised host</label>
                  {lanStatus?.candidates && lanStatus.candidates.length > 0 ? (
                    <select
                      className={styles.select}
                      value={lanAdvertisedHostDraft}
                      onChange={(event) =>
                        setLanAdvertisedHostDraft(event.target.value)
                      }
                    >
                      {lanStatus.candidates.map((c) => (
                        <option key={c.address} value={c.address}>
                          {c.name} — {c.address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={styles.select}
                      type="text"
                      value={lanAdvertisedHostDraft}
                      onChange={(event) =>
                        setLanAdvertisedHostDraft(event.target.value)
                      }
                      placeholder="e.g. 192.168.1.100"
                    />
                  )}
                </div>
                {lanStatus?.firewallWarning && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-warning-bg, #fef3c7)",
                      color: "var(--color-warning-text, #92400e)",
                      fontSize: "0.875rem",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Firewall may be blocking LAN access.</strong> The
                    API is not reachable on the advertised address. On Windows,
                    run:{" "}
                    <code
                      style={{
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {`netsh advfirewall firewall add rule name="Local Recipe Book" dir=in action=allow protocol=TCP localport=${lanStatus.api.port}`}
                    </code>
                  </div>
                )}
                <div
                  className={styles.fieldGroup}
                  style={{ marginTop: "1rem" }}
                >
                  <label className={styles.fieldLabel}>Connection URL</label>
                  <input
                    className={styles.select}
                    readOnly
                    type="text"
                    value={browserConnectionUrl}
                  />
                  <p className={styles.fieldHint}>
                    Use this link or QR code to pair a trusted device. It
                    contains the browser access token in the URL fragment.
                  </p>
                </div>
                <div
                  className={styles.actionsRow}
                  style={{ marginTop: "1rem" }}
                >
                  <Button
                    disabled={lanSaving}
                    onClick={() => void handleSaveLanSettings()}
                    type="button"
                    variant="outline"
                  >
                    {lanSaving ? "Saving..." : "Save LAN settings"}
                  </Button>
                  <Button
                    onClick={() => void handleGenerateMachineToken()}
                    type="button"
                    variant="outline"
                  >
                    Generate token
                  </Button>
                  <Button
                    onClick={() => void handleRotateMachineToken()}
                    type="button"
                    variant="outline"
                  >
                    Reset browser access
                  </Button>
                  <Button
                    disabled={!canShowLanQrCode}
                    onClick={() => setLanQrModalOpen(true)}
                    title={
                      canShowLanQrCode
                        ? undefined
                        : "Enable LAN API and browser UI, then generate a machine token first."
                    }
                    type="button"
                    variant="outline"
                  >
                    Show QR code
                  </Button>
                </div>
                {lanQrModalOpen &&
                browserConnectionUrl &&
                lanStatus?.api.url &&
                lanStatus?.web.url ? (
                  <Suspense fallback={null}>
                    <LanQrCodeModal
                      apiUrl={lanStatus.api.url}
                      browserUrl={lanStatus.web.url}
                      connectionUrl={browserConnectionUrl}
                      onClose={() => setLanQrModalOpen(false)}
                      onCopied={() => toast({ title: "Connection link copied." })}
                    />
                  </Suspense>
                ) : null}
              </div>
            )}
            <div className={styles.actionsRow} style={{ marginTop: "1rem" }}>
              <Button
                disabled={connectionSaving}
                onClick={() => void handleSaveConnection()}
                type="button"
                variant="outline"
              >
                {connectionSaving
                  ? "Saving…"
                  : connectionSaved
                    ? "Saved ✓"
                    : "Save connection"}
              </Button>
              <Button
                disabled={checkingForUpdates}
                onClick={() => void handleCheckForUpdates()}
                type="button"
                variant="outline"
              >
                {checkingForUpdates ? "Checking…" : "Check for updates"}
              </Button>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="home-dashboard" label="Home Dashboard">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Home overview controls</h2>
              <p className={styles.cardDescription}>
                Choose what appears on the home screen and how upcoming meals
                are detailed.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Upcoming meal range (days)
              </label>
              <div className={styles.rangeRow}>
                <input
                  className={styles.rangeInput}
                  max={30}
                  min={1}
                  onChange={(event) =>
                    void handleHomeUpcomingDays(Number(event.target.value))
                  }
                  step={1}
                  type="range"
                  value={homeDashboard.upcomingDays}
                />
                <div className={styles.rangeValue}>
                  {homeDashboard.upcomingDays}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Upcoming detail level
                </label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleHomeDetail(event.target.value)
                  }
                  value={homeDashboard.upcomingDetail}
                >
                  {homeUpcomingDetailOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.toggleList} style={{ marginTop: "1rem" }}>
              <ToggleRow
                checked={homeDashboard.upcomingCompact}
                description="Use tighter spacing for the upcoming-meals section."
                label="Compact upcoming meals"
                onChange={(checked) =>
                  void handleHomeToggle(
                    "upcomingCompact",
                    checked,
                    "home_upcoming_compact"
                  )
                }
              />
              <ToggleRow
                checked={homeDashboard.showUpcomingMeals}
                description="Show the upcoming-meals card on the home page."
                label="Show upcoming meals"
                onChange={(checked) =>
                  void handleHomeToggle(
                    "showUpcomingMeals",
                    checked,
                    "home_show_upcoming_meals"
                  )
                }
              />
              <ToggleRow
                checked={homeDashboard.showMealActivity}
                description="Show the meal activity heatmap card in Overview."
                label="Show meal activity"
                onChange={(checked) =>
                  void handleHomeToggle(
                    "showMealActivity",
                    checked,
                    "home_show_meal_activity"
                  )
                }
              />
              <ToggleRow
                checked={homeDashboard.showGroceryList}
                description="Show the grocery list card in Overview."
                label="Show grocery list"
                onChange={(checked) =>
                  void handleHomeToggle(
                    "showGroceryList",
                    checked,
                    "home_show_grocery_list"
                  )
                }
              />
              <ToggleRow
                checked={homeDashboard.showGreetingSubtitle}
                description="Show the date and subtitle under the greeting title on home."
                label="Show greeting date and subtitle"
                onChange={(checked) =>
                  void handleHomeToggle(
                    "showGreetingSubtitle",
                    checked,
                    "home_show_greeting_subtitle"
                  )
                }
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="app" label="App Settings">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Grocery & planning</h2>
            </div>
            <div className={styles.toggleList}>
              <ToggleRow
                checked={preferences.autoGenerateGrocery}
                description="Automatically create a grocery list when a meal plan is finalized."
                label="Auto-generate grocery list"
                onChange={(checked) =>
                  void handleImmediateField("autoGenerateGrocery", checked)
                }
              />
              <ToggleRow
                checked={preferences.consolidateIngredients}
                description="Merge quantities of the same ingredient across multiple meals."
                label="Consolidate similar ingredients"
                onChange={(checked) =>
                  void handleImmediateField("consolidateIngredients", checked)
                }
              />
            </div>
            <div className={styles.twoColumn} style={{ marginTop: "1rem" }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Default plan length</label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleImmediateField(
                      "defaultPlanLength",
                      event.target.value
                    )
                  }
                  value={preferences.defaultPlanLength}
                >
                  {planLengthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Grocery list grouping
                </label>
                <select
                  className={styles.select}
                  onChange={(event) =>
                    void handleImmediateField(
                      "groceryGrouping",
                      event.target.value
                    )
                  }
                  value={preferences.groceryGrouping}
                >
                  {groupingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.twoColumn} style={{ marginTop: "1rem" }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Default recipe view</label>
                <SegmentedControl
                  onChange={(value) =>
                    void handleImmediateField("defaultRecipeView", value)
                  }
                  options={recipeViewOptions}
                  value={preferences.defaultRecipeView}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Default unit mode</label>
                <SegmentedControl
                  onChange={(value) =>
                    void handleImmediateField("defaultUnitMode", value)
                  }
                  options={recipeUnitOptions}
                  value={preferences.defaultUnitMode}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Data & privacy</h2>
            </div>
            <p className={styles.fieldHint}>
              Export your data or reset local preferences. Chat and AI history
              is no longer stored by the app.
            </p>

            <div className={styles.actionsRow}>
              <Button
                onClick={() => void handleExport()}
                type="button"
                variant="outline"
              >
                Export my data
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline">
                    Reset all preferences
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all preferences?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will restore all settings to their defaults. Your
                      meal plans and grocery lists will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        onClick={() => void handleReset()}
                        type="button"
                        variant="outline"
                      >
                        Reset preferences
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
