import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { DayView } from "@/components/meal-plan/DayView";
import { DuplicateMealModal } from "@/components/meal-plan/DuplicateMealModal";
import { DeleteConfirmationModal } from "@/components/meal-plan/DeleteConfirmationModal";
import { DropIntentPopover } from "@/components/meal-plan/DropIntentPopover";
import { EditModal } from "@/components/meal-plan/EditModal";
import { MenuPrintExportModal } from "@/components/meal-plan/MenuPrintExportModal";
import {
  MealBankSidecar,
  type MealBankPlacement,
} from "@/components/meal-plan/MealBankSidecar";
import { MonthView } from "@/components/meal-plan/MonthView";
import { RecipeSearchModal } from "@/components/meal-plan/RecipeSearchModal";
import { SlotManagerModal } from "@/components/meal-plan/SlotManagerModal";
import { TrashDropZone } from "@/components/meal-plan/TrashDropZone";
import { WeekView } from "@/components/meal-plan/WeekView";
import { AddRecipeModal } from "@/components/recipes/AddRecipeModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import styles from "@/components/meal-plan/meal-plan.module.css";

import {
  createEmptyMeal,
  eachDayInRange,
  formatMealTypeProfileRange,
  fromCalendarMealType,
  getDefaultMealTypeProfile,
  getMealTypeProfileContext,
  getMealTypeProfileContexts,
  getMealTypeDefinitionsForDate,
  getTypeConfig,
  toBankMeal,
  type MealPlanDropAnchor,
  type MealPlanDropTarget,
  type MealPlanDragPayload,
  MONTHS,
  normalizeMealDate,
  toEditableMeal,
  toRangeByView,
  type CalendarMealType,
  type CalendarMeal,
  type BankMeal,
  type EditableMeal,
} from "@/lib/calendar";

import {
  applySlotBatchAction,
  createRecipe,
  createMeal,
  fetchJson,
  listUnscheduledMeals,
  reorderUnscheduledMeals,
  reorderSlotMeals as reorderSlotMealsApi,
} from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { useChatPageContext } from "@/context/chat-context";
import { useToast } from "@/components/providers/toast-provider";
import { useMealUndoRedo } from "@/components/meal-plan/use-meal-undo-redo";
import { mealToRecipePayload } from "@/lib/meal-to-recipe";
import { useMealTypeProfiles } from "@/lib/use-meal-types";
import { useMealSubTypeDefinitions } from "@/lib/use-meal-types";
import { getPlatform } from "@/lib/platform";
import type { CreateRecipeInput, RecipeConflict, RecipePayload } from "@shared/types";

type CalView = "day" | "week" | "month";

type SlotManagerState = {
  date: Date;
  type: CalendarMealType;
};

type DropIntentAction = "insert" | "swap";

type PendingDropIntent = {
  payload: MealPlanDragPayload;
  target: MealPlanDropTarget;
  anchor: MealPlanDropAnchor;
};

const MEAL_BANK_TYPE = "bank";
const MEAL_BANK_PLACEMENT_KEY = "meal_bank_sidecar_placement";
const MEAL_BANK_COLLAPSED_KEY = "meal_bank_collapsed";

type DeletedMealSnapshot = Pick<
  EditableMeal,
  | "name"
  | "date"
  | "type"
  | "sortOrder"
  | "mealTypeDefinitionId"
    | "mealSubTypeDefinitionId"
  | "notes"
  | "ingredients"
  | "description"
  | "cuisine"
  | "instructions"
  | "servings"
  | "prepTime"
  | "cookTime"
  | "servingsOverride"
  | "recipeId"
>;

function toDeletedMealSnapshot(meal: EditableMeal): DeletedMealSnapshot {
  return {
    name: meal.name,
    date: meal.date,
    type: meal.type,
    sortOrder: meal.sortOrder,
    mealTypeDefinitionId: meal.mealTypeDefinitionId,
      mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
    notes: meal.notes,
    ingredients: [...meal.ingredients],
    description: meal.description,
    cuisine: meal.cuisine,
    instructions: [...meal.instructions],
    servings: meal.servings,
    prepTime: meal.prepTime,
    cookTime: meal.cookTime,
    servingsOverride: meal.servingsOverride,
    recipeId: meal.recipeId,
  };
}

function toIsoString(date: Date) {
  return date.toISOString();
}

async function readChatResponse(message: string) {
  const config = getCachedConfig();
  const serverUrl = config?.url ?? "http://127.0.0.1:3001";
  const token = config?.token ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${serverUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Unable to fetch AI suggestion");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text.trim();
}

export default function MealPlanPage() {
  const navigate = useNavigate();
  const platform = useMemo(() => getPlatform(), []);
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const [view, setView] = useState<CalView>("week");
  const [highlightedProfileId, setHighlightedProfileId] = useState<
    string | null
  >(null);

  useEffect(() => {
    try {
      const storedView = localStorage.getItem("cal_view") as CalView | null;
      if (storedView) setView(storedView);
    } catch {
      // ignore persistence failures
    }
  }, []);
  const [date, setDate] = useState(() => new Date());
  const [editMeal, setEditMeal] = useState<EditableMeal | null>(null);
  const [slotManagerState, setSlotManagerState] =
    useState<SlotManagerState | null>(null);
  const [pendingDropIntent, setPendingDropIntent] =
    useState<PendingDropIntent | null>(null);
  const [isApplyingPendingDrop, setIsApplyingPendingDrop] = useState(false);
  const [isDraggingMeal, setIsDraggingMeal] = useState(false);
  const [trashPendingMeal, setTrashPendingMeal] = useState<EditableMeal | null>(
    null
  );
  const [isTrashDeleting, setIsTrashDeleting] = useState(false);
  const [trashDeleteError, setTrashDeleteError] = useState<
    string | undefined
  >();
  const deletedMealRef = useRef<DeletedMealSnapshot | null>(null);
  const queryClient = useQueryClient();
  const { toast, dismissAll, setDragging } = useToast();
  const { recordAction, discardLast, undo, redo } = useMealUndoRedo();
  const [saveAsRecipeMeal, setSaveAsRecipeMeal] = useState<EditableMeal | null>(
    null
  );
  const [duplicateMeal, setDuplicateMeal] = useState<EditableMeal | null>(null);
  const [isDuplicatingMeal, setIsDuplicatingMeal] = useState(false);
  const [duplicateMealError, setDuplicateMealError] = useState<string | null>(
    null
  );
  const [isMenuExportOpen, setIsMenuExportOpen] = useState(false);
  const [saveAsRecipeConflict, setSaveAsRecipeConflict] =
    useState<RecipeConflict | null>(null);
  const [isLinkingExistingRecipe, setIsLinkingExistingRecipe] = useState(false);
  const [recipeTitleFocusRequestKey, setRecipeTitleFocusRequestKey] =
    useState(0);
  const [bankEditMeal, setBankEditMeal] = useState<BankMeal | null>(null);
  const [isBankRecipeSearchOpen, setIsBankRecipeSearchOpen] = useState(false);
  const [bankRecipeSearchError, setBankRecipeSearchError] = useState<string | null>(null);
  const [mealBankPlacement, setMealBankPlacement] =
    useState<MealBankPlacement>("right");
  const [isMealBankCollapsed, setIsMealBankCollapsed] = useState(false);
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const createRecipeMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const dateRange = useMemo(() => toRangeByView(view, date), [view, date]);
  const mealsQueryKey = useMemo(
    () =>
      [
        "meals",
        view,
        dateRange.from.toISOString(),
        dateRange.to.toISOString(),
      ] as const,
    [dateRange.from, dateRange.to, view]
  );

  const mealsQuery = useQuery({
    queryKey: mealsQueryKey,
    enabled: apiReady,
    queryFn: () =>
      fetchJson<{ data: CalendarMeal[] }>(
        `/api/meals?from=${encodeURIComponent(toIsoString(dateRange.from))}&to=${encodeURIComponent(
          toIsoString(dateRange.to)
        )}`
      ).then((response) => response.data.map(toEditableMeal)),
  });

  const unscheduledMealsQuery = useQuery({
    queryKey: ["meals", "unscheduled"] as const,
    enabled: apiReady,
    queryFn: () =>
      listUnscheduledMeals().then((response) => response.map(toBankMeal)),
  });

  const meals = mealsQuery.data ?? [];
  const bankMeals = unscheduledMealsQuery.data ?? [];
  const mealTypeProfilesQuery = useMealTypeProfiles();
    const mealSubTypesQuery = useMealSubTypeDefinitions();
    const mealSubTypes = mealSubTypesQuery.data ?? [];
  const mealTypeProfiles = mealTypeProfilesQuery.data?.length
    ? mealTypeProfilesQuery.data
    : [getDefaultMealTypeProfile()];
  const mealTypeDefinitions = getMealTypeDefinitionsForDate(
    date,
    mealTypeProfiles
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      platform.getSetting(MEAL_BANK_PLACEMENT_KEY),
      platform.getSetting(MEAL_BANK_COLLAPSED_KEY),
    ]).then(([placement, collapsed]) => {
      if (cancelled) {
        return;
      }

      if (placement === "left" || placement === "right" || placement === "bottom") {
        setMealBankPlacement(placement);
      }

      if (typeof collapsed === "boolean") {
        setIsMealBankCollapsed(collapsed);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [platform]);
  const currentProfileContext = useMemo(
    () => getMealTypeProfileContext(date, mealTypeProfiles),
    [date, mealTypeProfiles]
  );
  const visibleDates = useMemo(
    () => eachDayInRange(dateRange.from, dateRange.to),
    [dateRange.from, dateRange.to]
  );
  const visibleProfileContexts = useMemo(
    () => getMealTypeProfileContexts(visibleDates, mealTypeProfiles),
    [visibleDates, mealTypeProfiles]
  );
  const visibleProfiles = useMemo(() => {
    const profileMap = new Map<
      string,
      {
        id: string;
        name: string;
        accentColor: string;
        rangeLabel: string | null;
        occurrenceCount: number;
        startsInRange: boolean;
        isCurrent: boolean;
      }
    >();

    for (const context of visibleProfileContexts) {
      const existing = profileMap.get(context.profile.id);

      if (existing) {
        existing.occurrenceCount += 1;
        existing.startsInRange =
          existing.startsInRange || context.isProfileStart;
        existing.isCurrent =
          existing.isCurrent ||
          context.profile.id === currentProfileContext.profile.id;
        continue;
      }

      profileMap.set(context.profile.id, {
        id: context.profile.id,
        name: context.profile.name,
        accentColor: context.accentColor,
        rangeLabel: formatMealTypeProfileRange(context.profile),
        occurrenceCount: 1,
        startsInRange: context.isProfileStart,
        isCurrent: context.profile.id === currentProfileContext.profile.id,
      });
    }

    return Array.from(profileMap.values()).sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }

      return (
        right.occurrenceCount - left.occurrenceCount ||
        left.name.localeCompare(right.name)
      );
    });
  }, [currentProfileContext.profile.id, visibleProfileContexts]);
  const highlightedProfile =
    visibleProfiles.find((profile) => profile.id === highlightedProfileId) ??
    null;
  const legendProfiles = useMemo(
    () =>
      visibleProfiles.map((visibleProfile) => {
        const sourceProfile =
          mealTypeProfiles.find(
            (profile) => profile.id === visibleProfile.id
          ) ?? currentProfileContext.profile;

        return {
          id: visibleProfile.id,
          name: visibleProfile.name,
          rangeLabel: visibleProfile.rangeLabel,
          mealTypes: sourceProfile.mealTypes,
        };
      }),
    [currentProfileContext.profile, mealTypeProfiles, visibleProfiles]
  );

  useEffect(() => {
    if (
      highlightedProfileId &&
      !visibleProfiles.some((profile) => profile.id === highlightedProfileId)
    ) {
      setHighlightedProfileId(null);
    }
  }, [highlightedProfileId, visibleProfiles]);

  const getMealTypesForDate = (value: Date) =>
    getMealTypeDefinitionsForDate(value, mealTypeProfiles);

  const findMealTypeDefinition = (mealType: string, value: Date) =>
    getMealTypesForDate(value).find(
      (definition) => definition.slug === mealType
    ) ?? null;

  const toEditableBankMeal = (meal: BankMeal): EditableMeal => {
    const fallbackDefinition =
      mealTypeDefinitions.find((definition) => definition.enabled) ??
      mealTypeDefinitions[0] ??
      null;

    return {
      ...meal,
      date: normalizeMealDate(date),
      type: fallbackDefinition?.slug ?? meal.type,
      mealTypeDefinitionId: fallbackDefinition?.id ?? null,
      mealTypeDefinition: fallbackDefinition,
    };
  };

  const setMealBankCollapsedPreference = (collapsed: boolean) => {
    setIsMealBankCollapsed(collapsed);
    void platform.setSetting(MEAL_BANK_COLLAPSED_KEY, collapsed);
  };

  useEffect(() => {
    if (view !== "month") {
      return;
    }

    setIsDraggingMeal(false);
    setDragging(false);
  }, [view, setDragging]);

  useEffect(() => {
    const isCalendarMealDragSource = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.closest('[data-meal-plan-drag-source="calendar-meal"]') !== null;
    };

    const handleDragStart = (event: DragEvent) => {
      if (viewRef.current === "month") {
        return;
      }

      if (!isCalendarMealDragSource(event.target)) {
        return;
      }

      setIsDraggingMeal(true);
      setDragging(true);
    };

    const handleDragFinish = () => {
      setIsDraggingMeal(false);
      setDragging(false);
    };

    window.addEventListener("dragstart", handleDragStart);
    window.addEventListener("dragend", handleDragFinish);
    window.addEventListener("drop", handleDragFinish);

    return () => {
      window.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("dragend", handleDragFinish);
      window.removeEventListener("drop", handleDragFinish);
    };
  }, [setDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMeal || trashPendingMeal || slotManagerState) return;

      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const isUndo = mod && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo =
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey));

      if (isUndo) {
        e.preventDefault();
        deletedMealRef.current = null;
        dismissAll();
        undo();
      } else if (isRedo) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMeal, slotManagerState, trashPendingMeal, undo, redo]);

  useChatPageContext({
    page: "meal-plan",
    view,
    date: date.toISOString(),
    dateRangeFrom: dateRange.from.toISOString(),
    dateRangeTo: dateRange.to.toISOString(),
    meals: meals.map((m) => ({
      id: m.id ?? "",
      name: m.name,
      mealType: m.type,
      date: m.date.toISOString(),
    })),
  });

  const switchView = (nextView: CalView) => {
    setView(nextView);
    try {
      localStorage.setItem("cal_view", nextView);
    } catch {
      // ignore persistence failures
    }
  };

  const updateMealsCache = (
    updater: (current: EditableMeal[]) => EditableMeal[]
  ) => {
    const previousMeals =
      queryClient.getQueryData<EditableMeal[]>(mealsQueryKey) ?? [];

    queryClient.setQueryData<EditableMeal[]>(mealsQueryKey, (current) =>
      updater(current ?? [])
    );
    return previousMeals;
  };

  const isMealInSlot = (
    meal: EditableMeal,
    slotDate: Date,
    slotType: CalendarMealType
  ) => {
    const normalizedSlotDate = normalizeMealDate(slotDate);
    const mealDate = normalizeMealDate(meal.date);

    return (
      meal.type === slotType &&
      mealDate.getFullYear() === normalizedSlotDate.getFullYear() &&
      mealDate.getMonth() === normalizedSlotDate.getMonth() &&
      mealDate.getDate() === normalizedSlotDate.getDate()
    );
  };

  const getOrderedSlotMeals = (
    sourceMeals: EditableMeal[],
    slotDate: Date,
    slotType: CalendarMealType
  ) => sourceMeals.filter((meal) => isMealInSlot(meal, slotDate, slotType));

  const applySlotOrderToMeals = (
    sourceMeals: EditableMeal[],
    slotDate: Date,
    slotType: CalendarMealType,
    orderedIds: string[]
  ) => {
    const orderedSlotMeals = orderedIds
      .map((mealId) =>
        sourceMeals.find(
          (meal) => meal.id === mealId && isMealInSlot(meal, slotDate, slotType)
        )
      )
      .filter((meal): meal is EditableMeal => Boolean(meal));

    let orderIndex = 0;

    return sourceMeals.map((meal) => {
      if (!isMealInSlot(meal, slotDate, slotType)) {
        return meal;
      }

      const nextMeal = orderedSlotMeals[orderIndex];
      orderIndex += 1;

      if (!nextMeal) {
        return meal;
      }

      return {
        ...nextMeal,
        sortOrder: orderIndex * 10,
      };
    });
  };

  const isSameSlotIdentity = (
    leftDate: Date,
    leftType: CalendarMealType,
    rightDate: Date,
    rightType: CalendarMealType
  ) => {
    const normalizedLeft = normalizeMealDate(leftDate);
    const normalizedRight = normalizeMealDate(rightDate);

    return (
      leftType === rightType &&
      normalizedLeft.getFullYear() === normalizedRight.getFullYear() &&
      normalizedLeft.getMonth() === normalizedRight.getMonth() &&
      normalizedLeft.getDate() === normalizedRight.getDate()
    );
  };

  const resolveDropTargetSlot = (
    target: MealPlanDropTarget,
    sourceMeals: EditableMeal[]
  ) => {
    if (target.kind === "slot") {
      return {
        date: normalizeMealDate(new Date(target.slotDate)),
        type: target.slotType,
      };
    }

    const targetMeal = sourceMeals.find((meal) => meal.id === target.mealId);
    if (!targetMeal) {
      return null;
    }

    return {
      date: normalizeMealDate(targetMeal.date),
      type: targetMeal.type,
    };
  };

  const reorderMealsInSlot = async (
    slotDate: Date,
    slotType: CalendarMealType,
    orderedIds: string[],
    summary: string
  ) => {
    const currentSlotMeals = getOrderedSlotMeals(meals, slotDate, slotType);
    const previousOrderedIds = currentSlotMeals
      .map((meal) => meal.id)
      .filter((mealId): mealId is string => Boolean(mealId));

    if (
      previousOrderedIds.length < 2 ||
      previousOrderedIds.length !== orderedIds.length ||
      previousOrderedIds.every((mealId, index) => mealId === orderedIds[index])
    ) {
      return;
    }

    const previousMeals = updateMealsCache((current) =>
      applySlotOrderToMeals(current, slotDate, slotType, orderedIds)
    );

    try {
      await reorderSlotMealsApi(slotDate, slotType, orderedIds);
      recordAction({
        type: "reorder",
        slotDate: normalizeMealDate(slotDate).toISOString(),
        slotType: fromCalendarMealType(slotType),
        previousOrderedIds,
        nextOrderedIds: orderedIds,
        summary,
      });
    } catch (error) {
      queryClient.setQueryData(mealsQueryKey, previousMeals);
      throw error;
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["meals"],
        exact: false,
      });
    }
  };

  const patchMeal = async (
    mealId: string,
    changes: Partial<Pick<EditableMeal, "date" | "type">>
  ) => {
    const payload: {
      date?: string;
      mealType?: ReturnType<typeof fromCalendarMealType>;
      mealTypeDefinitionId?: string | null;
      mealSubTypeDefinitionId?: string | null;
    } = {};

    if (changes.date) {
      payload.date = normalizeMealDate(changes.date).toISOString();
    }

    if (changes.type) {
      const effectiveDate =
        changes.date ?? meals.find((meal) => meal.id === mealId)?.date ?? date;
      payload.mealType = fromCalendarMealType(changes.type);
      payload.mealTypeDefinitionId =
        findMealTypeDefinition(changes.type, effectiveDate)?.id ?? null;
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${mealId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  };

  const moveMealToBank = async (mealId: string) => {
    const meal = meals.find((entry) => entry.id === mealId);
    if (!meal) {
      return;
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${mealId}`, {
      method: "PATCH",
      body: JSON.stringify({
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: null,
        sortOrder: (bankMeals.length + 1) * 10,
      }),
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
    recordAction({
      type: "bank-transfer",
      mealId,
      from: {
        date: normalizeMealDate(meal.date).toISOString(),
        mealType: fromCalendarMealType(meal.type),
        mealTypeDefinitionId: meal.mealTypeDefinitionId,
        mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
      },
      to: {
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: null,
      },
      summary: `Moved ${meal.name} to Meal Bank`,
    });
    toast({
      title: `Moved ${meal.name} to Meal Bank`,
      duration: 4000,
    });
  };

  const handleDropMealToBank = async (mealId: string) => {
    try {
      await moveMealToBank(mealId);
    } finally {
      setIsDraggingMeal(false);
      setDragging(false);
    }
  };

  const scheduleBankMeal = async (
    meal: BankMeal,
    targetDate: Date,
    targetType: CalendarMealType
  ) => {
    const normalizedTargetDate = normalizeMealDate(targetDate);
    const targetDefinition = findMealTypeDefinition(targetType, normalizedTargetDate);

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${meal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        date: normalizedTargetDate.toISOString(),
        mealType: fromCalendarMealType(targetType),
        mealTypeDefinitionId: targetDefinition?.id ?? null,
        mealSubTypeDefinitionId: null,
      }),
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
    recordAction({
      type: "bank-transfer",
      mealId: meal.id,
      from: {
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
      },
      to: {
        date: normalizedTargetDate.toISOString(),
        mealType: fromCalendarMealType(targetType),
        mealTypeDefinitionId: targetDefinition?.id ?? null,
        mealSubTypeDefinitionId: null,
      },
      summary: `Scheduled ${meal.name}`,
    });
    toast({
      title: `Scheduled ${meal.name}`,
      description: `Added to ${targetDate.toLocaleDateString()}.`,
      duration: 4000,
    });
  };

  const saveBankMeal = async (updatedMeal: EditableMeal) => {
    if (!bankEditMeal) {
      return;
    }

    if (!bankEditMeal.id) {
      const created = await createMeal({
        name: updatedMeal.name,
        date: null,
        mealType: MEAL_BANK_TYPE,
        sortOrder: (bankMeals.length + 1) * 10,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: updatedMeal.mealSubTypeDefinitionId ?? null,
        notes: updatedMeal.notes || null,
        ingredients: updatedMeal.ingredients,
        description: updatedMeal.description || null,
        cuisine: updatedMeal.cuisine,
        instructions: updatedMeal.instructions,
        servings: updatedMeal.servings,
        prepTime: updatedMeal.prepTime,
        cookTime: updatedMeal.cookTime,
        servingsOverride: updatedMeal.servingsOverride,
        recipeId: updatedMeal.recipeId,
      });

      recordAction({
        type: "add",
        mealId: created.id,
        snapshot: {
          name: updatedMeal.name,
          date: null,
          mealType: MEAL_BANK_TYPE,
          mealTypeDefinitionId: null,
          mealSubTypeDefinitionId: updatedMeal.mealSubTypeDefinitionId ?? null,
          sortOrder: (bankMeals.length + 1) * 10,
          notes: updatedMeal.notes || null,
          ingredients: updatedMeal.ingredients,
          description: updatedMeal.description || null,
          cuisine: updatedMeal.cuisine,
          instructions: updatedMeal.instructions,
          servings: updatedMeal.servings,
          prepTime: updatedMeal.prepTime,
          cookTime: updatedMeal.cookTime,
          servingsOverride: updatedMeal.servingsOverride,
          recipeId: updatedMeal.recipeId,
        },
        summary: `Added ${updatedMeal.name} to Meal Bank`,
      });

      setBankEditMeal(null);
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
      return;
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${bankEditMeal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: updatedMeal.name,
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: updatedMeal.mealSubTypeDefinitionId ?? null,
        notes: updatedMeal.notes,
        ingredients: updatedMeal.ingredients,
        description: updatedMeal.description || null,
        cuisine: updatedMeal.cuisine,
        instructions: updatedMeal.instructions,
        servings: updatedMeal.servings,
        prepTime: updatedMeal.prepTime,
        cookTime: updatedMeal.cookTime,
        servingsOverride: updatedMeal.servingsOverride,
        recipeId: updatedMeal.recipeId,
      }),
    });

    setBankEditMeal(null);
    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const buildBankMealDraftFromRecipe = (
    recipe: RecipePayload,
    servings: number,
    personalNote: string
  ) => {
    const metadataLines = personalNote.trim() ? [personalNote.trim()] : [];

    return {
      name: recipe.title,
      date: null,
      mealType: MEAL_BANK_TYPE,
      sortOrder: (bankMeals.length + 1) * 10,
      mealTypeDefinitionId: null,
      mealSubTypeDefinitionId: null,
      notes: metadataLines.length > 0 ? metadataLines.join("\n") : null,
      ingredients: recipe.ingredients.map((ingredient, index) => ({
        name: ingredient.name,
        quantity:
          ingredient.quantity === null || ingredient.quantity === undefined
            ? null
            : `${ingredient.quantity}`,
        unit: ingredient.unit,
        group: ingredient.group ?? null,
        notes: ingredient.notes,
        order: ingredient.order ?? index,
      })),
      description: recipe.description,
      cuisine: recipe.cuisine,
      instructions: recipe.instructions,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servingsOverride: servings !== recipe.servings ? servings : null,
      recipeId: recipe.id,
    };
  };

  const addBankMealFromRecipe = async (
    recipe: RecipePayload,
    servings: number,
    personalNote: string
  ) => {
    const payload = buildBankMealDraftFromRecipe(recipe, servings, personalNote);
    const created = await createMeal(payload);

    recordAction({
      type: "add",
      mealId: created.id,
      snapshot: {
        name: payload.name,
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: null,
        sortOrder: payload.sortOrder,
        notes: payload.notes,
        ingredients: payload.ingredients,
        description: payload.description,
        cuisine: payload.cuisine,
        instructions: payload.instructions,
        servings: payload.servings,
        prepTime: payload.prepTime,
        cookTime: payload.cookTime,
        servingsOverride: payload.servingsOverride,
        recipeId: payload.recipeId,
      },
      summary: `Added ${payload.name} to Meal Bank`,
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const duplicateBankMeal = async (meal: BankMeal) => {
    const created = await createMeal({
      name: meal.name,
      date: null,
      mealType: MEAL_BANK_TYPE,
      sortOrder: (bankMeals.length + 1) * 10,
      mealTypeDefinitionId: null,
      mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
      notes: meal.notes || null,
      ingredients: meal.ingredients,
      description: meal.description || null,
      cuisine: meal.cuisine,
      instructions: meal.instructions,
      servings: meal.servings,
      prepTime: meal.prepTime,
      cookTime: meal.cookTime,
      servingsOverride: meal.servingsOverride,
      recipeId: meal.recipeId,
    });

    recordAction({
      type: "add",
      mealId: created.id,
      snapshot: {
        name: meal.name,
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
        sortOrder: (bankMeals.length + 1) * 10,
        notes: meal.notes || null,
        ingredients: meal.ingredients,
        description: meal.description || null,
        cuisine: meal.cuisine,
        instructions: meal.instructions,
        servings: meal.servings,
        prepTime: meal.prepTime,
        cookTime: meal.cookTime,
        servingsOverride: meal.servingsOverride,
        recipeId: meal.recipeId,
      },
      summary: `Duplicated ${meal.name} in Meal Bank`,
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const deleteBankMeal = async (meal: BankMeal) => {
    await deleteMealById(meal.id);
    recordAction({
      type: "delete",
      mealId: meal.id,
      snapshot: {
        name: meal.name,
        date: null,
        mealType: MEAL_BANK_TYPE,
        mealTypeDefinitionId: null,
        mealSubTypeDefinitionId: meal.mealSubTypeDefinitionId ?? null,
        sortOrder: meal.sortOrder,
        notes: meal.notes || null,
        ingredients: [...meal.ingredients],
        description: meal.description || null,
        cuisine: meal.cuisine,
        instructions: [...meal.instructions],
        servings: meal.servings,
        prepTime: meal.prepTime,
        cookTime: meal.cookTime,
        servingsOverride: meal.servingsOverride,
        recipeId: meal.recipeId,
      },
      summary: `Deleted ${meal.name} from Meal Bank`,
    });
    toast({
      title: `Deleted ${meal.name} from Meal Bank`,
      description: "Use undo to restore it.",
      duration: 5000,
    });
  };

  const onSaveMeal = async (updatedMeal: EditableMeal) => {
    const normalizedDate = normalizeMealDate(updatedMeal.date);
    const payload = {
      name: updatedMeal.name,
      date: normalizedDate.toISOString(),
      mealType: fromCalendarMealType(updatedMeal.type),
      mealTypeDefinitionId:
        updatedMeal.mealTypeDefinitionId ??
        findMealTypeDefinition(updatedMeal.type, normalizedDate)?.id ??
        null,
        mealSubTypeDefinitionId: updatedMeal.mealSubTypeDefinitionId ?? null,
      notes: updatedMeal.notes,
      ingredients: updatedMeal.ingredients,
      description: updatedMeal.description || null,
      cuisine: updatedMeal.cuisine,
      instructions: updatedMeal.instructions,
      servings: updatedMeal.servings,
      prepTime: updatedMeal.prepTime,
      cookTime: updatedMeal.cookTime,
      servingsOverride: updatedMeal.servingsOverride,
      recipeId: updatedMeal.recipeId,
    };

    if (updatedMeal.id) {
      await fetchJson<{ data: CalendarMeal }>(`/api/meals/${updatedMeal.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      const response = await fetchJson<{ data: CalendarMeal }>("/api/meals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      recordAction({
        type: "add",
        mealId: response.data.id,
        snapshot: {
          name: payload.name,
          date: payload.date,
          mealType: payload.mealType,
          sortOrder: response.data.sortOrder,
          mealSubTypeDefinitionId: payload.mealSubTypeDefinitionId,
          notes: payload.notes || null,
          ingredients: payload.ingredients ?? [],
          description: payload.description,
          cuisine: payload.cuisine,
          instructions: payload.instructions,
          servings: payload.servings,
          prepTime: payload.prepTime,
          cookTime: payload.cookTime,
          servingsOverride: payload.servingsOverride,
          recipeId: payload.recipeId,
        },
        summary: `Added ${payload.name}`,
      });
    }

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const onMoveMeal = async (
    meal: EditableMeal,
    targetDate: Date,
    targetType: CalendarMealType
  ) => {
    if (!meal.id) {
      return;
    }

    const normalizedTargetDate = normalizeMealDate(targetDate);
    const isSameSlot =
      meal.type === targetType &&
      meal.date.getFullYear() === normalizedTargetDate.getFullYear() &&
      meal.date.getMonth() === normalizedTargetDate.getMonth() &&
      meal.date.getDate() === normalizedTargetDate.getDate();

    if (isSameSlot) {
      return;
    }

    const targetDefinition = findMealTypeDefinition(
      targetType,
      normalizedTargetDate
    );

    const previousMeals = updateMealsCache((current) =>
      current.map((currentMeal) =>
        currentMeal.id === meal.id
          ? {
              ...currentMeal,
              date: normalizedTargetDate,
              type: targetType,
              mealTypeDefinitionId: targetDefinition?.id ?? null,
              mealTypeDefinition: targetDefinition,
            }
          : currentMeal
      )
    );

    try {
      await patchMeal(meal.id, {
        date: normalizedTargetDate,
        type: targetType,
      });
      recordAction({
        type: "move",
        mealId: meal.id,
        fromDate: normalizeMealDate(meal.date).toISOString(),
        fromType: fromCalendarMealType(meal.type),
        toDate: normalizedTargetDate.toISOString(),
        toType: fromCalendarMealType(targetType),
        summary: `Moved ${meal.name}`,
      });
    } catch (error) {
      queryClient.setQueryData(mealsQueryKey, previousMeals);
      throw error;
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["meals"],
        exact: false,
      });
    }
  };

  const onSwapMeals = async (
    draggedMeal: EditableMeal,
    targetMeal: EditableMeal,
    insertAfter: boolean
  ) => {
    if (!draggedMeal.id || !targetMeal.id || draggedMeal.id === targetMeal.id) {
      return;
    }

    const draggedSourceDate = normalizeMealDate(draggedMeal.date);
    const targetSourceDate = normalizeMealDate(targetMeal.date);
    const sameSlot =
      draggedMeal.type === targetMeal.type &&
      draggedSourceDate.getFullYear() === targetSourceDate.getFullYear() &&
      draggedSourceDate.getMonth() === targetSourceDate.getMonth() &&
      draggedSourceDate.getDate() === targetSourceDate.getDate();

    if (sameSlot) {
      const slotMeals = getOrderedSlotMeals(meals, draggedSourceDate, draggedMeal.type);
      const orderedIds = slotMeals
        .map((meal) => meal.id)
        .filter((mealId): mealId is string => Boolean(mealId));
      const draggedIndex = orderedIds.indexOf(draggedMeal.id);
      const targetIndex = orderedIds.indexOf(targetMeal.id);

      if (draggedIndex < 0 || targetIndex < 0) {
        return;
      }

      const nextOrderedIds = orderedIds.filter((mealId) => mealId !== draggedMeal.id);
      const baseTargetIndex = nextOrderedIds.indexOf(targetMeal.id);
      const insertionIndex = insertAfter ? baseTargetIndex + 1 : baseTargetIndex;

      nextOrderedIds.splice(insertionIndex, 0, draggedMeal.id);

      await reorderMealsInSlot(
        draggedSourceDate,
        draggedMeal.type,
        nextOrderedIds,
        `Reordered ${draggedMeal.name}`
      );
      return;
    }

    const previousMeals = updateMealsCache((current) =>
      current.map((currentMeal) => {
        if (currentMeal.id === draggedMeal.id) {
          const nextDefinition = findMealTypeDefinition(
            targetMeal.type,
            targetSourceDate
          );
          return {
            ...currentMeal,
            date: targetSourceDate,
            type: targetMeal.type,
            mealTypeDefinitionId: nextDefinition?.id ?? null,
            mealTypeDefinition: nextDefinition,
          };
        }

        if (currentMeal.id === targetMeal.id) {
          const nextDefinition = findMealTypeDefinition(
            draggedMeal.type,
            draggedSourceDate
          );
          return {
            ...currentMeal,
            date: draggedSourceDate,
            type: draggedMeal.type,
            mealTypeDefinitionId: nextDefinition?.id ?? null,
            mealTypeDefinition: nextDefinition,
          };
        }

        return currentMeal;
      })
    );

    try {
      await Promise.all([
        patchMeal(draggedMeal.id, {
          date: targetSourceDate,
          type: targetMeal.type,
        }),
        patchMeal(targetMeal.id, {
          date: draggedSourceDate,
          type: draggedMeal.type,
        }),
      ]);
      recordAction({
        type: "swap",
        meal1Id: draggedMeal.id,
        meal1Date: draggedSourceDate.toISOString(),
        meal1Type: fromCalendarMealType(draggedMeal.type),
        meal2Id: targetMeal.id,
        meal2Date: targetSourceDate.toISOString(),
        meal2Type: fromCalendarMealType(targetMeal.type),
        summary: `Swapped ${draggedMeal.name} and ${targetMeal.name}`,
      });
    } catch (error) {
      queryClient.setQueryData(mealsQueryKey, previousMeals);
      throw error;
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["meals"],
        exact: false,
      });
    }
  };

  const applySlotAction = async (
    action: "move" | "swap",
    sourceSlot: { date: Date; type: CalendarMealType },
    targetSlot: { date: Date; type: CalendarMealType }
  ) => {
    if (
      isSameSlotIdentity(
        sourceSlot.date,
        sourceSlot.type,
        targetSlot.date,
        targetSlot.type
      )
    ) {
      return;
    }

    await applySlotBatchAction({
      action,
      source: {
        date: normalizeMealDate(sourceSlot.date).toISOString(),
        mealType: fromCalendarMealType(sourceSlot.type),
        mealTypeDefinitionId:
          findMealTypeDefinition(sourceSlot.type, sourceSlot.date)?.id ?? null,
      },
      target: {
        date: normalizeMealDate(targetSlot.date).toISOString(),
        mealType: fromCalendarMealType(targetSlot.type),
        mealTypeDefinitionId:
          findMealTypeDefinition(targetSlot.type, targetSlot.date)?.id ?? null,
      },
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const insertMealIntoTargetSlot = async (
    draggedMeal: EditableMeal,
    targetMeal: EditableMeal,
    insertAfter: boolean
  ) => {
    if (!draggedMeal.id || !targetMeal.id) {
      return;
    }

    const targetSlotDate = normalizeMealDate(targetMeal.date);
    const targetSlotType = targetMeal.type;

    await onMoveMeal(draggedMeal, targetSlotDate, targetSlotType);

    const latestMeals =
      queryClient.getQueryData<EditableMeal[]>(mealsQueryKey) ?? meals;
    const slotMeals = getOrderedSlotMeals(latestMeals, targetSlotDate, targetSlotType);
    const orderedIds = slotMeals
      .map((meal) => meal.id)
      .filter((mealId): mealId is string => Boolean(mealId));

    const nextOrderedIds = orderedIds.filter((mealId) => mealId !== draggedMeal.id);
    const targetIndex = nextOrderedIds.indexOf(targetMeal.id);

    if (targetIndex < 0) {
      return;
    }

    const insertionIndex = insertAfter ? targetIndex + 1 : targetIndex;
    nextOrderedIds.splice(insertionIndex, 0, draggedMeal.id);

    await reorderMealsInSlot(
      targetSlotDate,
      targetSlotType,
      nextOrderedIds,
      `Inserted ${draggedMeal.name}`
    );
  };

  const applyDropIntentAction = async (
    payload: MealPlanDragPayload,
    target: MealPlanDropTarget,
    action: DropIntentAction
  ) => {
    if (payload.kind === "bank-meal") {
      const draggedMeal = bankMeals.find((meal) => meal.id === payload.mealId);
      if (!draggedMeal) {
        return;
      }

      const targetSlot = resolveDropTargetSlot(target, meals);
      if (!targetSlot) {
        return;
      }

      await scheduleBankMeal(draggedMeal, targetSlot.date, targetSlot.type);
      return;
    }

    if (payload.kind === "meal") {
      const draggedMeal = meals.find((meal) => meal.id === payload.mealId);
      if (!draggedMeal) {
        return;
      }

      if (target.kind === "slot") {
        const targetDate = normalizeMealDate(new Date(target.slotDate));
        await onMoveMeal(draggedMeal, targetDate, target.slotType);
        return;
      }

      const targetMeal = meals.find((meal) => meal.id === target.mealId);
      if (!targetMeal) {
        return;
      }

      if (action === "swap") {
        await onSwapMeals(draggedMeal, targetMeal, target.insertAfter);
        return;
      }

      await insertMealIntoTargetSlot(draggedMeal, targetMeal, target.insertAfter);
      return;
    }

    const sourceSlot = {
      date: normalizeMealDate(new Date(payload.slotDate)),
      type: payload.slotType,
    };
    const targetSlot = resolveDropTargetSlot(target, meals);

    if (!targetSlot) {
      return;
    }

    await applySlotAction(action === "swap" ? "swap" : "move", sourceSlot, targetSlot);
  };

  const onDropPayload = async (
    payload: MealPlanDragPayload,
    target: MealPlanDropTarget,
    anchor: MealPlanDropAnchor
  ) => {
    if (payload.kind === "bank-meal") {
      const draggedMeal = bankMeals.find((meal) => meal.id === payload.mealId);
      if (!draggedMeal) {
        return;
      }

      const targetSlot = resolveDropTargetSlot(target, meals);
      if (!targetSlot) {
        return;
      }

      await scheduleBankMeal(draggedMeal, targetSlot.date, targetSlot.type);
      return;
    }

    if (payload.kind === "meal") {
      const draggedMeal = meals.find((meal) => meal.id === payload.mealId);
      if (!draggedMeal) {
        return;
      }

      if (target.kind === "slot") {
        const targetDate = normalizeMealDate(new Date(target.slotDate));

        if (isSameSlotIdentity(draggedMeal.date, draggedMeal.type, targetDate, target.slotType)) {
          return;
        }

        await onMoveMeal(draggedMeal, targetDate, target.slotType);
        return;
      }

      const targetMeal = meals.find((meal) => meal.id === target.mealId);
      if (!targetMeal) {
        return;
      }

      const sameSlot = isSameSlotIdentity(
        draggedMeal.date,
        draggedMeal.type,
        targetMeal.date,
        targetMeal.type
      );

      if (sameSlot) {
        await onSwapMeals(draggedMeal, targetMeal, target.insertAfter);
        return;
      }

      setPendingDropIntent({ payload, target, anchor });
      return;
    }

    const sourceSlot = {
      date: normalizeMealDate(new Date(payload.slotDate)),
      type: payload.slotType,
    };
    const targetSlot = resolveDropTargetSlot(target, meals);

    if (!targetSlot) {
      return;
    }

    if (
      isSameSlotIdentity(
        sourceSlot.date,
        sourceSlot.type,
        targetSlot.date,
        targetSlot.type
      )
    ) {
      return;
    }

    const targetSlotMeals = getOrderedSlotMeals(meals, targetSlot.date, targetSlot.type);

    if (targetSlotMeals.length === 0) {
      await applySlotAction("move", sourceSlot, targetSlot);
      return;
    }

    setPendingDropIntent({ payload, target, anchor });
  };

  const onApplyPendingDropIntent = async (action: DropIntentAction) => {
    const nextIntent = pendingDropIntent;

    if (!nextIntent || isApplyingPendingDrop) {
      return;
    }

    setIsApplyingPendingDrop(true);

    try {
      await applyDropIntentAction(nextIntent.payload, nextIntent.target, action);
      setPendingDropIntent(null);
    } finally {
      setIsApplyingPendingDrop(false);
    }
  };

  const deleteMealById = async (mealId: string) => {
    await fetchJson<{ data: { id: string } }>(`/api/meals/${mealId}`, {
      method: "DELETE",
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const createMealFromSnapshot = async (snapshot: DeletedMealSnapshot) => {
    await fetchJson<{ data: CalendarMeal }>("/api/meals", {
      method: "POST",
      body: JSON.stringify({
        name: snapshot.name,
        date: normalizeMealDate(snapshot.date).toISOString(),
        mealType: fromCalendarMealType(snapshot.type),
        sortOrder: snapshot.sortOrder,
        mealTypeDefinitionId: snapshot.mealTypeDefinitionId,
        notes: snapshot.notes ? snapshot.notes : null,
        ingredients: snapshot.ingredients,
        description: snapshot.description || null,
        cuisine: snapshot.cuisine,
        instructions: snapshot.instructions,
        servings: snapshot.servings,
        prepTime: snapshot.prepTime,
        cookTime: snapshot.cookTime,
        servingsOverride: snapshot.servingsOverride,
        recipeId: snapshot.recipeId,
      }),
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
  };

  const showUndoDeleteToast = (snapshot: DeletedMealSnapshot) => {
    deletedMealRef.current = snapshot;

    toast({
      title: `Deleted ${snapshot.name}`,
      description: "The meal was removed from your plan.",
      duration: 30_000,
      action: {
        label: "Undo",
        onClick: async () => {
          const mealToRestore = deletedMealRef.current;
          if (!mealToRestore) {
            return;
          }

          deletedMealRef.current = null;
          try {
            await createMealFromSnapshot(mealToRestore);
            discardLast("delete");
            toast({
              title: `Restored ${mealToRestore.name}`,
              duration: 5_000,
            });
          } catch {
            toast({
              title: "Unable to restore meal",
              description: "Please try adding the meal again.",
              variant: "error",
            });
          }
        },
      },
    });
  };

  const onDeleteMeal = async (mealId: string) => {
    const mealToDelete = meals.find((entry) => entry.id === mealId);
    await deleteMealById(mealId);

    if (mealToDelete) {
      recordAction({
        type: "delete",
        mealId,
        snapshot: {
          name: mealToDelete.name,
          date: normalizeMealDate(mealToDelete.date).toISOString(),
          mealType: fromCalendarMealType(mealToDelete.type),
          sortOrder: mealToDelete.sortOrder,
          notes: mealToDelete.notes || null,
          ingredients: [...mealToDelete.ingredients],
          description: mealToDelete.description || null,
          cuisine: mealToDelete.cuisine,
          instructions: [...mealToDelete.instructions],
          servings: mealToDelete.servings,
          prepTime: mealToDelete.prepTime,
          cookTime: mealToDelete.cookTime,
          servingsOverride: mealToDelete.servingsOverride,
          recipeId: mealToDelete.recipeId,
        },
        summary: `Deleted ${mealToDelete.name}`,
      });
      showUndoDeleteToast(toDeletedMealSnapshot(mealToDelete));
    }
  };

  const onTrashDropMeal = (mealId: string) => {
    const meal = meals.find((entry) => entry.id === mealId);
    if (!meal) {
      return;
    }

    setTrashDeleteError(undefined);
    setTrashPendingMeal(meal);
    setIsDraggingMeal(false);
  };

  const onConfirmTrashDelete = async () => {
    if (!trashPendingMeal?.id) {
      return;
    }

    setIsTrashDeleting(true);
    setTrashDeleteError(undefined);

    const snapshot = toDeletedMealSnapshot(trashPendingMeal);

    try {
      await deleteMealById(trashPendingMeal.id);
      recordAction({
        type: "delete",
        mealId: trashPendingMeal.id,
        snapshot: {
          name: snapshot.name,
          date: normalizeMealDate(snapshot.date).toISOString(),
          mealType: fromCalendarMealType(snapshot.type),
          sortOrder: snapshot.sortOrder,
          notes: snapshot.notes || null,
          ingredients: [...snapshot.ingredients],
          description: snapshot.description || null,
          cuisine: snapshot.cuisine,
          instructions: [...snapshot.instructions],
          servings: snapshot.servings,
          prepTime: snapshot.prepTime,
          cookTime: snapshot.cookTime,
          servingsOverride: snapshot.servingsOverride,
          recipeId: snapshot.recipeId,
        },
        summary: `Deleted ${snapshot.name}`,
      });
      setTrashPendingMeal(null);
      showUndoDeleteToast(snapshot);
    } catch (error) {
      setTrashDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete meal. Please try again."
      );
    } finally {
      setIsTrashDeleting(false);
    }
  };

  const handleSaveAsRecipe = async (meal: EditableMeal) => {
    setSaveAsRecipeConflict(null);
    setSaveAsRecipeMeal(meal);
    setEditMeal(null);
  };

  const handleSaveRecipeConflict = (conflict: RecipeConflict) => {
    setSaveAsRecipeConflict(conflict);
    toast({
      title: "Recipe name already exists",
      description:
        conflict.code === "RECIPE_DUPLICATE_SOURCE_URL"
          ? "This source URL is already in your Recipe Book. Link the existing recipe or rename the draft."
          : `"${conflict.existing.title}" already exists. Rename the draft or link the existing recipe.`,
      duration: 6000,
    });
  };

  const closeSaveAsRecipeFlow = () => {
    setIsLinkingExistingRecipe(false);
    setSaveAsRecipeConflict(null);
    setSaveAsRecipeMeal(null);
  };

  const openSlotManager = (slotDate: Date, slotType: CalendarMealType) => {
    setSlotManagerState({
      date: normalizeMealDate(slotDate),
      type: slotType,
    });
  };

  const closeSlotManager = (didMutate: boolean) => {
    setSlotManagerState(null);

    if (didMutate) {
      void queryClient.invalidateQueries({
        queryKey: ["meals"],
        exact: false,
      });
    }
  };

  const slotManagerMeals = slotManagerState
    ? getOrderedSlotMeals(meals, slotManagerState.date, slotManagerState.type)
    : [];
  const slotManagerMealTypeDefinition = slotManagerState
    ? findMealTypeDefinition(slotManagerState.type, slotManagerState.date)
    : null;

  const handleSaveRecipeFromMeal = async (input: CreateRecipeInput) => {
    if (!saveAsRecipeMeal) return;
    const mealToLink = saveAsRecipeMeal;
    const recipe = await createRecipeMutation.mutateAsync(input);

    if (mealToLink.id) {
      try {
        await fetchJson<{ data: CalendarMeal }>(
          `/api/meals/${mealToLink.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              recipeId: recipe.id,
              cuisine: recipe.cuisine,
            }),
          }
        );
        await queryClient.invalidateQueries({
          queryKey: ["meals"],
          exact: false,
        });
      } catch (error) {
        closeSaveAsRecipeFlow();
        console.error("[meal-plan] Recipe saved but meal linking failed", error);
        toast({
          title: `Saved "${recipe.title}" to Recipe Book`,
          description:
            "The recipe was saved, but we could not link this meal right now. Open the meal and use Link Recipe to reconnect.",
          duration: 6500,
        });
        return;
      }
    }

    closeSaveAsRecipeFlow();
    toast({
      title: `Saved "${recipe.title}" to Recipe Book`,
      description: mealToLink.id
        ? "This meal is now linked to the recipe."
        : undefined,
      duration: 5000,
    });
  };

  const handleLinkExistingRecipe = async () => {
    if (!saveAsRecipeMeal?.id || !saveAsRecipeConflict || isLinkingExistingRecipe) {
      return;
    }

    setIsLinkingExistingRecipe(true);

    try {
      await fetchJson<{ data: CalendarMeal }>(
        `/api/meals/${saveAsRecipeMeal.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            recipeId: saveAsRecipeConflict.existing.id,
            cuisine: saveAsRecipeConflict.existing.cuisine ?? null,
          }),
        }
      );
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });

      const existingTitle = saveAsRecipeConflict.existing.title;
      closeSaveAsRecipeFlow();
      toast({
        title: `Linked to "${existingTitle}"`,
        description: "This meal now points to the existing recipe.",
        duration: 5000,
      });
    } catch (error) {
      console.error("[meal-plan] Failed to link existing recipe", error);
      toast({
        title: "Could not link the existing recipe.",
        description: "Please try again in a moment.",
        variant: "error",
      });
    } finally {
      setIsLinkingExistingRecipe(false);
    }
  };

  const handleUnlinkRecipe = async (meal: EditableMeal) => {
    if (!meal.id || !meal.linkedRecipe) return;

    try {
      await fetchJson<{ data: CalendarMeal }>(`/api/meals/${meal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          recipeId: null,
          description: meal.linkedRecipe.description || null,
          cuisine: meal.linkedRecipe.cuisine,
          instructions: meal.linkedRecipe.instructions,
          ingredients: meal.linkedRecipe.ingredients,
          servings: meal.servingsOverride ?? meal.linkedRecipe.servings,
          prepTime: meal.linkedRecipe.prepTime,
          cookTime: meal.linkedRecipe.cookTime,
          servingsOverride: null,
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
      setEditMeal(null);
      toast({
        title: "Recipe unlinked",
        description: "This meal is now standalone and can be linked again at any time.",
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: "Could not unlink recipe",
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
        variant: "error",
      });
    }
  };
  const handleViewLinkedRecipe = (recipeId: string) => {
    setEditMeal(null);
    navigate(`/recipes/${recipeId}`);
  };

  const handleDuplicateMeal = async ({
    date,
    mealType,
    mealTypeDefinitionId,
  }: {
    date: Date;
    mealType: string;
    mealTypeDefinitionId: string | null;
  }) => {
    if (!duplicateMeal) {
      return;
    }

    setIsDuplicatingMeal(true);
    setDuplicateMealError(null);

    try {
      const created = await createMeal({
        name: duplicateMeal.name,
        date: date.toISOString(),
        mealType,
        mealTypeDefinitionId,
        mealSubTypeDefinitionId: duplicateMeal.mealSubTypeDefinitionId ?? null,
        notes: duplicateMeal.notes || null,
        ingredients: duplicateMeal.ingredients,
        description: duplicateMeal.description,
        cuisine: duplicateMeal.cuisine,
        instructions: duplicateMeal.instructions,
        servings: duplicateMeal.servings,
        prepTime: duplicateMeal.prepTime,
        cookTime: duplicateMeal.cookTime,
        servingsOverride: duplicateMeal.servingsOverride,
        recipeId: duplicateMeal.recipeId,
      });

      recordAction({
        type: "add",
        mealId: created.id,
        snapshot: {
          name: duplicateMeal.name,
          date: date.toISOString(),
          mealType,
          mealSubTypeDefinitionId: duplicateMeal.mealSubTypeDefinitionId ?? null,
          notes: duplicateMeal.notes || null,
          ingredients: duplicateMeal.ingredients,
          description: duplicateMeal.description,
          cuisine: duplicateMeal.cuisine,
          instructions: duplicateMeal.instructions,
          servings: duplicateMeal.servings,
          prepTime: duplicateMeal.prepTime,
          cookTime: duplicateMeal.cookTime,
          servingsOverride: duplicateMeal.servingsOverride,
          recipeId: duplicateMeal.recipeId,
        },
        summary: `Duplicated ${duplicateMeal.name}`,
      });

      setDuplicateMeal(null);
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
    } catch (error) {
      setDuplicateMealError(
        error instanceof Error ? error.message : "Unable to duplicate meal"
      );
    } finally {
      setIsDuplicatingMeal(false);
    }
  };

  const onResuggest = async (meal: EditableMeal) => {
    const answer = await readChatResponse(
      `Re-suggest a ${meal.type} meal for ${meal.date.toDateString()} based on my preferences. Return a short meal name and one sentence.`
    );

    const nextName =
      answer
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0)
        ?.replace(/^[-*\d.)\s]+/, "") ?? meal.name;

    return {
      name: nextName.replace(/^"|"$/g, ""),
    };
  };

  const bankEditProxy = bankEditMeal ? toEditableBankMeal(bankEditMeal) : null;

  const pageTitle =
    view === "day"
      ? "Daily Meal Plan"
      : view === "week"
        ? "Weekly Meal Plan"
        : "Monthly Meal Plan";
  const pageDateLabel =
    view === "day"
      ? date.toLocaleDateString("default", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : view === "week"
        ? "Plan and review your meals week by week."
        : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

  return (
    <div className={styles.calendarPage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Meal Plan</div>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <p className={styles.pageSub}>{pageDateLabel}</p>
        </div>
        <div className={styles.pageHeaderRight}>
          <button
            className={styles.btnAddMeal}
            onClick={() =>
              setEditMeal(
                createEmptyMeal(
                  new Date(date),
                  mealTypeDefinitions.find((definition) => definition.enabled)
                    ?.slug ??
                    mealTypeDefinitions[0]?.slug ??
                    "DINNER",
                  mealTypeDefinitions.find(
                    (definition) => definition.enabled
                  ) ??
                    mealTypeDefinitions[0] ??
                    null
                )
              )
            }
            type="button"
          >
            + Add Meal
          </button>
          <button
            className={styles.btnToday}
            onClick={() => setIsMenuExportOpen(true)}
            type="button"
          >
            Print / Export
          </button>
          <button
            className={styles.btnToday}
            onClick={() => setDate(new Date())}
            type="button"
          >
            Today
          </button>
          <div className={styles.viewToggle}>
            {(["day", "week", "month"] as const).map((option) => (
              <button
                className={`${styles.viewBtn} ${view === option ? styles.viewBtnActive : ""}`}
                key={option}
                onClick={() => switchView(option)}
                type="button"
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {highlightedProfile ? (
        <div className={styles.cardFocusBar}>
          <div className={styles.cardFocusCopy}>
            <span
              className={styles.cardFocusSwatch}
              style={{ background: highlightedProfile.accentColor }}
            />
            <span className={styles.cardFocusText}>
              Focused on {highlightedProfile.name}
            </span>
          </div>
          <button
            className={styles.cardFocusClear}
            onClick={() => setHighlightedProfileId(null)}
            type="button"
          >
            Clear focus
          </button>
        </div>
      ) : null}

      <div
        className={`${styles.mealPlanWorkspace} ${
          mealBankPlacement === "left"
            ? styles.mealPlanWorkspaceLeft
            : mealBankPlacement === "bottom"
              ? styles.mealPlanWorkspaceBottom
              : styles.mealPlanWorkspaceRight
        }`}
      >
        {mealBankPlacement === "left" ? (
          <MealBankSidecar
            activeDate={date}
            collapsed={isMealBankCollapsed}
            error={unscheduledMealsQuery.error}
            isCalendarMealDragging={isDraggingMeal}
            isLoading={unscheduledMealsQuery.isLoading}
            mealTypes={mealTypeDefinitions}
            meals={bankMeals}
            placement={mealBankPlacement}
            onAddCustomMeal={() => {
              setBankRecipeSearchError(null);
              setBankEditMeal({
                id: "",
                name: "",
                date: null,
                type: MEAL_BANK_TYPE,
                sortOrder: (bankMeals.length + 1) * 10,
                mealTypeDefinitionId: null,
                mealTypeDefinition: null,
                mealSubTypeDefinitionId: null,
                mealSubTypeDefinition: null,
                notes: "",
                ingredients: [],
                description: "",
                cuisine: null,
                instructions: [],
                servings: 2,
                prepTime: null,
                cookTime: null,
                servingsOverride: null,
                recipeId: null,
                linkedRecipe: null,
              });
            }}
            onAddFromRecipe={() => {
              setBankRecipeSearchError(null);
              setIsBankRecipeSearchOpen(true);
            }}
            onDelete={(meal) => {
              void deleteBankMeal(meal);
            }}
            onDuplicate={(meal) => {
              void duplicateBankMeal(meal);
            }}
            onDropMealToBank={handleDropMealToBank}
            onEdit={setBankEditMeal}
            onReorder={async (orderedIds) => {
              await reorderUnscheduledMeals(orderedIds);
              await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
            }}
            onSchedule={(meal, mealType) => scheduleBankMeal(meal, date, mealType)}
            onToggleCollapsed={setMealBankCollapsedPreference}
          />
        ) : null}
        <div className={styles.calCard}>
          {view === "day" ? (
            <DayView
              date={date}
              dragDisabled={false}
              meals={meals}
              mealTypeProfiles={mealTypeProfiles}
              highlightedProfileId={highlightedProfileId}
              onEdit={setEditMeal}
              onOpenSlotManager={openSlotManager}
              onDropPayload={onDropPayload}
              setDate={setDate}
            />
          ) : null}
          {view === "week" ? (
            <WeekView
              date={date}
              dragDisabled={false}
              meals={meals}
              mealTypeProfiles={mealTypeProfiles}
              highlightedProfileId={highlightedProfileId}
              onEdit={setEditMeal}
              onDuplicateMeal={setDuplicateMeal}
              onOpenSlotManager={openSlotManager}
              onDropPayload={onDropPayload}
              setDate={setDate}
            />
          ) : null}
          {view === "month" ? (
            <MonthView
              date={date}
              meals={meals}
              mealTypeProfiles={mealTypeProfiles}
              highlightedProfileId={highlightedProfileId}
              onEdit={setEditMeal}
              onRequestDayView={() => switchView("day")}
              onRequestWeekView={() => switchView("week")}
              setDate={setDate}
            />
          ) : null}
        </div>
        {mealBankPlacement !== "left" ? (
          <MealBankSidecar
            activeDate={date}
            collapsed={isMealBankCollapsed}
            error={unscheduledMealsQuery.error}
            isCalendarMealDragging={isDraggingMeal}
            isLoading={unscheduledMealsQuery.isLoading}
            mealTypes={mealTypeDefinitions}
            meals={bankMeals}
            placement={mealBankPlacement}
            onAddCustomMeal={() => {
              setBankRecipeSearchError(null);
              setBankEditMeal({
                id: "",
                name: "",
                date: null,
                type: MEAL_BANK_TYPE,
                sortOrder: (bankMeals.length + 1) * 10,
                mealTypeDefinitionId: null,
                mealTypeDefinition: null,
                mealSubTypeDefinitionId: null,
                mealSubTypeDefinition: null,
                notes: "",
                ingredients: [],
                description: "",
                cuisine: null,
                instructions: [],
                servings: 2,
                prepTime: null,
                cookTime: null,
                servingsOverride: null,
                recipeId: null,
                linkedRecipe: null,
              });
            }}
            onAddFromRecipe={() => {
              setBankRecipeSearchError(null);
              setIsBankRecipeSearchOpen(true);
            }}
            onDelete={(meal) => {
              void deleteBankMeal(meal);
            }}
            onDuplicate={(meal) => {
              void duplicateBankMeal(meal);
            }}
            onDropMealToBank={handleDropMealToBank}
            onEdit={setBankEditMeal}
            onReorder={async (orderedIds) => {
              await reorderUnscheduledMeals(orderedIds);
              await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
            }}
            onSchedule={(meal, mealType) => scheduleBankMeal(meal, date, mealType)}
            onToggleCollapsed={setMealBankCollapsedPreference}
          />
        ) : null}
      </div>

      <DropIntentPopover
        anchor={pendingDropIntent?.anchor ?? null}
        isApplying={isApplyingPendingDrop}
        isOpen={Boolean(pendingDropIntent)}
        onCancel={() => setPendingDropIntent(null)}
        onSelect={(action) => {
          void onApplyPendingDropIntent(action);
        }}
      />

      <TrashDropZone visible={isDraggingMeal} onDropMeal={onTrashDropMeal} />

      {isMenuExportOpen ? (
        <MenuPrintExportModal
          initialFrom={dateRange.from}
          initialTo={dateRange.to}
          onClose={() => setIsMenuExportOpen(false)}
        />
      ) : null}

      <div className={styles.legendStack}>
        <div className={styles.legendSection}>
          <div className={styles.legendHeadingRow}>
            <h2 className={styles.legendTitle}>Profile accents</h2>
            <p className={styles.legendHint}>
              {highlightedProfile
                ? `Focusing ${highlightedProfile.name}. Other profile days stay visible but subdued.`
                : visibleProfiles.length > 1
                  ? "Profile accents indicate which meal type profile applies to each day in view."
                  : `All visible days use the ${currentProfileContext.profile.name} profile.`}
            </p>
          </div>
          <div className={styles.legend}>
            {visibleProfiles.map((profile) => (
              <div className={styles.legendItem} key={profile.id}>
                <span
                  className={styles.legendDot}
                  style={{ background: profile.accentColor }}
                />
                <span className={styles.legendText}>{profile.name}</span>
              </div>
            ))}
          </div>
        </div>

        {legendProfiles.map((profile) => (
          <div className={styles.legendSection} key={profile.id}>
            <div className={styles.legendHeadingRow}>
              <h2
                className={styles.legendTitle}
              >{`Meal types for ${profile.name}`}</h2>
              <p className={styles.legendHint}>
                {profile.rangeLabel ?? "Shown for the selected date range."}
              </p>
            </div>
            <div className={styles.legend}>
              {profile.mealTypes
                .filter((definition) => definition.enabled)
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((definition) => {
                  const config = getTypeConfig(
                    definition.slug,
                    profile.mealTypes
                  );

                  return (
                    <div className={styles.legendItem} key={definition.id}>
                      <span
                        className={styles.legendDot}
                        style={{ background: config.dot }}
                      />
                      <span className={styles.legendText}>{config.label}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {editMeal ? (
        <EditModal
          meal={editMeal}
          mealSubTypes={mealSubTypes}
          mealTypeProfiles={mealTypeProfiles}
          onClose={() => setEditMeal(null)}
          onDelete={onDeleteMeal}
          onResuggest={onResuggest}
          onSave={onSaveMeal}
          onSaveAsRecipe={handleSaveAsRecipe}
          onUnlinkRecipe={handleUnlinkRecipe}
                  onViewLinkedRecipe={handleViewLinkedRecipe}
        />
      ) : null}

      {bankEditProxy ? (
        <EditModal
          meal={bankEditProxy}
          mealSubTypes={mealSubTypes}
          mealTypeProfiles={mealTypeProfiles}
          onClose={() => setBankEditMeal(null)}
          onDelete={async (mealId) => {
            await deleteMealById(mealId);
            setBankEditMeal(null);
          }}
          onResuggest={onResuggest}
          onSave={saveBankMeal}
          onSaveAsRecipe={handleSaveAsRecipe}
          onUnlinkRecipe={handleUnlinkRecipe}
          onViewLinkedRecipe={handleViewLinkedRecipe}
        />
      ) : null}

      {duplicateMeal ? (
        <DuplicateMealModal
          error={duplicateMealError}
          isDuplicating={isDuplicatingMeal}
          isOpen
          meal={duplicateMeal}
          mealTypeProfiles={mealTypeProfiles}
          onClose={() => {
            if (isDuplicatingMeal) {
              return;
            }

            setDuplicateMealError(null);
            setDuplicateMeal(null);
          }}
          onDuplicate={(target) => {
            void handleDuplicateMeal(target);
          }}
          referenceDate={date}
        />
      ) : null}

      {slotManagerState ? (
        <SlotManagerModal
          mealTypeDefinition={slotManagerMealTypeDefinition}
          onAddMeal={() => {
            const slot = slotManagerState;
            closeSlotManager(false);
            setEditMeal(
              createEmptyMeal(
                new Date(slot.date),
                slot.type,
                findMealTypeDefinition(slot.type, slot.date)
              )
            );
          }}
          onClose={closeSlotManager}
          onDelete={onDeleteMeal}
          onEdit={(meal) => {
            closeSlotManager(false);
            setEditMeal(meal);
          }}
          onReorder={async (orderedIds) => {
            await reorderMealsInSlot(
              slotManagerState.date,
              slotManagerState.type,
              orderedIds,
              `Reordered ${getTypeConfig(slotManagerState.type, mealTypeDefinitions).label.toLowerCase()} slot`
            );
          }}
          slotDate={slotManagerState.date}
          slotMeals={slotManagerMeals}
          slotType={slotManagerState.type}
        />
      ) : null}

      {saveAsRecipeMeal ? (
        <AddRecipeModal
          open
          focusTitleRequestKey={recipeTitleFocusRequestKey}
          initialRecipe={mealToRecipePayload(saveAsRecipeMeal)}
          isSaving={createRecipeMutation.isPending}
          onClose={closeSaveAsRecipeFlow}
          onConflict={handleSaveRecipeConflict}
          onSave={handleSaveRecipeFromMeal}
        />
      ) : null}

      <RecipeSearchModal
        currentMealName=""
        errorMessage={bankRecipeSearchError}
        onClose={() => {
          setIsBankRecipeSearchOpen(false);
          setBankRecipeSearchError(null);
        }}
        onSelectRecipe={async (recipe, servings, personalNote) => {
          setBankRecipeSearchError(null);
          try {
            await addBankMealFromRecipe(recipe, servings, personalNote);
            setIsBankRecipeSearchOpen(false);
          } catch (error) {
            setBankRecipeSearchError(
              error instanceof Error
                ? error.message
                : "Unable to add this recipe to the Meal Bank right now."
            );
          }
        }}
        open={isBankRecipeSearchOpen}
      />

      <AlertDialog
        open={Boolean(saveAsRecipeConflict)}
        onOpenChange={(open) => {
          if (isLinkingExistingRecipe) {
            return;
          }

          if (!open) {
            setSaveAsRecipeConflict(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recipe already exists</AlertDialogTitle>
            <AlertDialogDescription>
              {saveAsRecipeConflict?.code === "RECIPE_DUPLICATE_SOURCE_URL"
                ? `The source URL for "${saveAsRecipeConflict?.existing.title ?? "this recipe"}" is already in your Recipe Book.`
                : `A recipe named "${saveAsRecipeConflict?.existing.title ?? "this recipe"}" already exists in your Recipe Book.`}{" "}
              Duplicate recipe names are not allowed. Link this meal to the
              existing recipe, or rename the draft and try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              className={styles.btnGhost}
              disabled={isLinkingExistingRecipe}
              onClick={() => setSaveAsRecipeConflict(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.btnLinkRecipe}
              disabled={isLinkingExistingRecipe}
              onClick={() => {
                setSaveAsRecipeConflict(null);
                setRecipeTitleFocusRequestKey((current) => current + 1);
              }}
              type="button"
            >
              Continue Editing
            </button>
            <button
              className={styles.btnSave}
              disabled={!saveAsRecipeMeal?.id || isLinkingExistingRecipe}
              onClick={() => {
                void handleLinkExistingRecipe();
              }}
              type="button"
            >
              {isLinkingExistingRecipe ? "Linking..." : "Link Existing"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {trashPendingMeal ? (
        <DeleteConfirmationModal
          mealName={trashPendingMeal.name}
          isOpen
          isLoading={isTrashDeleting}
          error={trashDeleteError}
          onConfirm={onConfirmTrashDelete}
          onCancel={() => {
            if (isTrashDeleting) {
              return;
            }

            setTrashDeleteError(undefined);
            setTrashPendingMeal(null);
          }}
        />
      ) : null}

      {mealsQuery.isLoading ? (
        <p className={styles.pageSub} style={{ marginTop: "0.85rem" }}>
          Loading meals...
        </p>
      ) : null}
      {mealsQuery.error ? (
        <p
          className={styles.pageSub}
          style={{ marginTop: "0.85rem", color: "#A0441A" }}
        >
          Unable to load meals. Please try again.
        </p>
      ) : null}
    </div>
  );
}
