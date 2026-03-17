"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PersonaModal } from "@/components/settings/PersonaModal";

import { ChipList } from "@/components/settings/ChipList";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { PersonaGrid } from "@/components/settings/PersonaGrid";
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
import { useChatContext, useChatPageContext } from "@/context/chat-context";
import {
  clearChatHistory,
  createPersona,
  deletePersona,
  detectRegion,
  exportUserData,
  getPersonas,
  getPreferences,
  patchPreferences,
  resetPreferences,
  updatePersona,
  type CustomPersonaPayload,
  type SettingsPreferences,
} from "@/lib/api";
import { cn } from "@/lib/utils";

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

const cuisineOptions = [
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Japanese", value: "japanese" },
  { label: "Comfort food", value: "comfort-food" },
  { label: "Mexican", value: "mexican" },
  { label: "Thai", value: "thai" },
  { label: "Indian", value: "indian" },
  { label: "Italian", value: "italian" },
  { label: "Korean", value: "korean" },
  { label: "Middle Eastern", value: "middle-eastern" },
  { label: "French", value: "french" },
  { label: "Chinese", value: "chinese" },
  { label: "American BBQ", value: "american-bbq" },
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

const personaOptions = [
  {
    value: "coach",
    icon: "🧑‍🍳",
    name: "The Coach",
    subtitle: "Encouraging, practical",
  },
  {
    value: "scientist",
    icon: "👨‍🔬",
    name: "The Scientist",
    subtitle: "Precise, data-driven",
  },
  {
    value: "entertainer",
    icon: "🎭",
    name: "The Entertainer",
    subtitle: "Witty, energetic",
  },
  {
    value: "minimalist",
    icon: "🧘",
    name: "The Minimalist",
    subtitle: "Terse, efficient",
  },
  {
    value: "professor",
    icon: "📚",
    name: "The Professor",
    subtitle: "Thoughtful, educational",
  },
  {
    value: "michelin",
    icon: "⭐",
    name: "The Michelin",
    subtitle: "Refined, high standards",
  },
];

const replyLengthOptions = [
  { label: "Concise", value: "concise" },
  { label: "Balanced", value: "balanced" },
  { label: "Detailed", value: "detailed" },
];

const emojiOptions = [
  { label: "Occasional", value: "occasional" },
  { label: "Frequent", value: "frequent" },
  { label: "None", value: "none" },
];

const regionOptions = [
  { label: "Northern US / Canada", value: "northern-us-canada" },
  { label: "Eastern US", value: "eastern-us" },
  { label: "Southern US", value: "southern-us" },
  { label: "Western US / Pacific", value: "western-us" },
  { label: "Western Europe", value: "western-europe" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "East Asia", value: "east-asia" },
  { label: "South Asia", value: "south-asia" },
  { label: "Australia / NZ", value: "australia-nz" },
  { label: "Southern hemisphere", value: "southern-hemisphere" },
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
  { label: "Detailed", value: "detailed" },
  { label: "Cooking", value: "cooking" },
];

const recipeUnitOptions = [
  { label: "Cup", value: "cup" },
  { label: "Grams", value: "grams" },
];

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { clearSession } = useChatContext();
  const patchMutation = useMutation({ mutationFn: patchPreferences });
  const resetMutation = useMutation({ mutationFn: resetPreferences });
  const clearHistoryMutation = useMutation({ mutationFn: clearChatHistory });
  const preferencesQuery = useQuery({
    queryKey: preferenceQueryKey,
    queryFn: getPreferences,
  });

  const preferences = preferencesQuery.data;

  const customPersonasQueryKey = ["personas"] as const;
  const customPersonasQuery = useQuery({
    queryKey: customPersonasQueryKey,
    queryFn: getPersonas,
  });
  const customPersonas = customPersonasQuery.data ?? [];

  type PersonaModalState =
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; persona: CustomPersonaPayload };
  const [personaModalState, setPersonaModalState] = useState<PersonaModalState>(
    { open: false }
  );

  const householdTimerRef = useRef<number | null>(null);
  const notesTimerRef = useRef<number | null>(null);
  const detectResetTimerRef = useRef<number | null>(null);

  const [householdSizeDraft, setHouseholdSizeDraft] = useState(2);
  const [householdSizeDirty, setHouseholdSizeDirty] = useState(false);
  const [householdScheduled, setHouseholdScheduled] = useState(false);
  const [planningNotesDraft, setPlanningNotesDraft] = useState("");
  const [planningNotesDirty, setPlanningNotesDirty] = useState(false);
  const [notesScheduled, setNotesScheduled] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [detectState, setDetectState] = useState<
    "idle" | "detecting" | "success"
  >("idle");

  useChatPageContext({ page: "settings" });

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
      clearBrowserTimer(detectResetTimerRef);
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

  const allPersonaOptions = useMemo(
    () => [
      ...personaOptions,
      ...customPersonas.map((p) => ({
        value: p.id,
        icon: p.emoji,
        name: p.title,
        subtitle: p.description,
        isCustom: true as const,
      })),
    ],
    [customPersonas]
  );

  const handlePersonaModalSave = async (input: {
    emoji: string;
    title: string;
    description: string;
    prompt: string;
  }) => {
    if (personaModalState.open && personaModalState.mode === "edit") {
      await updatePersona(personaModalState.persona.id, input);
      toast({ title: "Persona updated." });
    } else {
      const created = await createPersona(input);
      await commitPatch({ chefPersona: created.id });
      toast({ title: "Custom persona created." });
    }
    await queryClient.invalidateQueries({ queryKey: customPersonasQueryKey });
    setPersonaModalState({ open: false });
  };

  const handlePersonaDelete = async (id: string) => {
    await deletePersona(id);
    if (preferences?.chefPersona === id) {
      await commitPatch({ chefPersona: "coach" });
    }
    await queryClient.invalidateQueries({ queryKey: customPersonasQueryKey });
    toast({ title: "Persona deleted." });
    setPersonaModalState({ open: false });
  };

  const handleDetectRegion = async () => {
    setDetectState("detecting");
    try {
      const detected = await detectRegion();
      if (!detected.region) {
        throw new Error(detected.error ?? "Could not detect region");
      }

      await commitPatch({ seasonalRegion: detected.region });
      setDetectState("success");
      clearBrowserTimer(detectResetTimerRef);
      detectResetTimerRef.current = window.setTimeout(
        () => setDetectState("idle"),
        1400
      );
    } catch {
      setDetectState("idle");
      toast({
        title: "Could not detect region automatically.",
        variant: "error",
      });
    }
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

  const handleClearChatHistory = async () => {
    try {
      await clearHistoryMutation.mutateAsync();
      clearSession();
      toast({ title: "Chat history cleared." });
    } catch {
      toast({ title: "Could not clear chat history.", variant: "error" });
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
            Tune dietary direction, planning behavior, and the tone Copilot Chef
            uses when it helps you cook.
          </p>
        </div>
        <div className={cn(styles.autosavePill, saveState.className)}>
          {saveState.label}
        </div>
      </header>

      <CollapsibleSection id="dietary" label="Dietary Profile">
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
                  void handleImmediateField("cookingLength", event.target.value)
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
                options={cuisineOptions}
                selectedValues={preferences.favoriteCuisines}
                tone="orange"
              />
            </div>
            <div className={styles.cuisineDivider} />
            <div className={styles.cuisineColumn}>
              <div className={styles.columnHeading}>Avoid</div>
              <TagCloud
                onToggle={(value) =>
                  void handleCuisineToggle("avoidCuisines", value)
                }
                options={cuisineOptions}
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
              onAdd={(values) => void handleChipAdd("avoidIngredients", values)}
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

      <CollapsibleSection id="chef" label="Your Chef">
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Chef personality</h2>
            <p className={styles.cardDescription}>
              Choose how your AI chef talks to you.
            </p>
          </div>
          <PersonaGrid
            onCreateCustom={() =>
              setPersonaModalState({ open: true, mode: "create" })
            }
            onEditCustom={(id) => {
              const persona = customPersonas.find((p) => p.id === id);
              if (persona)
                setPersonaModalState({ open: true, mode: "edit", persona });
            }}
            onSelect={(value) =>
              void handleImmediateField("chefPersona", value)
            }
            options={allPersonaOptions}
            value={preferences.chefPersona}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Response style</h2>
          </div>
          <div className={styles.twoColumn}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Default reply length</label>
              <SegmentedControl
                onChange={(value) =>
                  void handleImmediateField("replyLength", value)
                }
                options={replyLengthOptions}
                value={preferences.replyLength}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Use of emoji in responses
              </label>
              <SegmentedControl
                onChange={(value) =>
                  void handleImmediateField("emojiUsage", value)
                }
                options={emojiOptions}
                value={preferences.emojiUsage}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="app" label="App Settings">
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>AI behavior</h2>
          </div>
          <div className={styles.toggleList}>
            <ToggleRow
              checked={preferences.autoImproveChef}
              description="Chef learns from your feedback and adjusts suggestions over time."
              label="Auto-improve chef"
              onChange={(checked) =>
                void handleImmediateField("autoImproveChef", checked)
              }
            />
            <ToggleRow
              checked={preferences.contextAwareness}
              description="Include current meal plan and pantry when generating ideas."
              label="Context-aware suggestions"
              onChange={(checked) =>
                void handleImmediateField("contextAwareness", checked)
              }
            />
            <div>
              <ToggleRow
                checked={preferences.seasonalAwareness}
                description="Prioritize ingredients that are in season in your region."
                label="Seasonal awareness"
                onChange={(checked) =>
                  void handleImmediateField("seasonalAwareness", checked)
                }
              />
              <div
                className={cn(
                  styles.regionWrap,
                  !preferences.seasonalAwareness && styles.regionWrapClosed
                )}
              >
                <div className={styles.regionRow}>
                  <select
                    className={styles.select}
                    onChange={(event) =>
                      void handleImmediateField(
                        "seasonalRegion",
                        event.target.value
                      )
                    }
                    value={preferences.seasonalRegion}
                  >
                    {regionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={detectState === "detecting"}
                    onClick={() => void handleDetectRegion()}
                    type="button"
                    variant="outline"
                  >
                    {detectState === "detecting"
                      ? "Detecting…"
                      : detectState === "success"
                        ? "Detected ✓"
                        : "Detect"}
                  </Button>
                </div>
              </div>
            </div>
            <ToggleRow
              checked={preferences.proactiveTips}
              description="Chef offers unprompted suggestions and cooking tips in chat."
              label="Proactive tips"
              onChange={(checked) =>
                void handleImmediateField("proactiveTips", checked)
              }
            />
          </div>
        </div>

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
              <label className={styles.fieldLabel}>Grocery list grouping</label>
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
          <ToggleRow
            checked={preferences.saveChatHistory}
            description="Persist conversations for context across sessions."
            label="Save chat history"
            onChange={(checked) =>
              void handleImmediateField("saveChatHistory", checked)
            }
          />

          <div className={styles.actionsRow}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className={styles.dangerButton}
                  type="button"
                  variant="outline"
                >
                  Clear chat history
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all saved conversations. This
                    cannot be undone.
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
                      className={styles.dangerButton}
                      onClick={() => void handleClearChatHistory()}
                      type="button"
                      variant="outline"
                    >
                      Clear history
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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
                    This will restore all settings to their defaults. Your meal
                    plans and grocery lists will not be affected.
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

      {personaModalState.open && (
        <PersonaModal
          modalMode={
            personaModalState.mode === "create"
              ? { mode: "create" }
              : { mode: "edit", persona: personaModalState.persona }
          }
          onClose={() => setPersonaModalState({ open: false })}
          onDelete={
            personaModalState.mode === "edit"
              ? (id) => handlePersonaDelete(id)
              : undefined
          }
          onSave={(input) => handlePersonaModalSave(input)}
        />
      )}
    </div>
  );
}
