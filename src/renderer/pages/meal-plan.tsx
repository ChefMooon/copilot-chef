import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DayView } from "@/components/meal-plan/DayView";
import { DeleteConfirmationModal } from "@/components/meal-plan/DeleteConfirmationModal";
import { EditModal } from "@/components/meal-plan/EditModal";
import { MenuPrintExportModal } from "@/components/meal-plan/MenuPrintExportModal";
import { MonthView } from "@/components/meal-plan/MonthView";
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
  MONTHS,
  normalizeMealDate,
  toEditableMeal,
  toRangeByView,
  type CalendarMealType,
  type CalendarMeal,
  type EditableMeal,
} from "@/lib/calendar";

import { createRecipe, fetchJson } from "@/lib/api";
import { useChatPageContext } from "@/context/chat-context";
import { useToast } from "@/components/providers/toast-provider";
import { useMealUndoRedo } from "@/components/meal-plan/use-meal-undo-redo";
import { getCachedConfig } from "@/lib/config";
import { mealToRecipePayload } from "@/lib/meal-to-recipe";
import { useMealTypeProfiles } from "@/lib/use-meal-types";
import type { CreateRecipeInput, RecipeConflict } from "@shared/types";

type CalView = "day" | "week" | "month";

type DeletedMealSnapshot = Pick<
  EditableMeal,
  | "name"
  | "date"
  | "type"
  | "mealTypeDefinitionId"
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
    mealTypeDefinitionId: meal.mealTypeDefinitionId,
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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
  const [view, setView] = useState<CalView>("week");
  const [highlightedProfileId, setHighlightedProfileId] = useState<string | null>(null);

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
  const [isDraggingMeal, setIsDraggingMeal] = useState(false);
  const [trashPendingMeal, setTrashPendingMeal] = useState<EditableMeal | null>(null);
  const [isTrashDeleting, setIsTrashDeleting] = useState(false);
  const [trashDeleteError, setTrashDeleteError] = useState<string | undefined>();
  const deletedMealRef = useRef<DeletedMealSnapshot | null>(null);
  const queryClient = useQueryClient();
  const { toast, dismissAll, setDragging } = useToast();
  const { recordAction, discardLast, undo, redo } = useMealUndoRedo();
  const [saveAsRecipeMeal, setSaveAsRecipeMeal] = useState<EditableMeal | null>(null);
  const [isMenuExportOpen, setIsMenuExportOpen] = useState(false);
  const [saveAsRecipeConflict, setSaveAsRecipeConflict] =
    useState<RecipeConflict | null>(null);

  const createRecipeMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const dateRange = useMemo(() => toRangeByView(view, date), [view, date]);
  const mealsQueryKey = useMemo(
    () => [
      "meals",
      view,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ] as const,
    [dateRange.from, dateRange.to, view]
  );

  const mealsQuery = useQuery({
    queryKey: mealsQueryKey,
    queryFn: () =>
      fetchJson<{ data: CalendarMeal[] }>(
        `/api/meals?from=${encodeURIComponent(toIsoString(dateRange.from))}&to=${encodeURIComponent(
          toIsoString(dateRange.to)
        )}`
      ).then((response) => response.data.map(toEditableMeal)),
  });

  const meals = mealsQuery.data ?? [];
  const mealTypeProfilesQuery = useMealTypeProfiles();
  const mealTypeProfiles =
    mealTypeProfilesQuery.data?.length
      ? mealTypeProfilesQuery.data
      : [getDefaultMealTypeProfile()];
  const mealTypeDefinitions = getMealTypeDefinitionsForDate(date, mealTypeProfiles);
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
        existing.startsInRange = existing.startsInRange || context.isProfileStart;
        existing.isCurrent = existing.isCurrent || context.profile.id === currentProfileContext.profile.id;
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

      return right.occurrenceCount - left.occurrenceCount || left.name.localeCompare(right.name);
    });
  }, [currentProfileContext.profile.id, visibleProfileContexts]);
  const highlightedProfile =
    visibleProfiles.find((profile) => profile.id === highlightedProfileId) ?? null;
  const legendProfiles = useMemo(
    () =>
      visibleProfiles.map((visibleProfile) => {
        const sourceProfile =
          mealTypeProfiles.find((profile) => profile.id === visibleProfile.id) ??
          currentProfileContext.profile;

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
    if (highlightedProfileId && !visibleProfiles.some((profile) => profile.id === highlightedProfileId)) {
      setHighlightedProfileId(null);
    }
  }, [highlightedProfileId, visibleProfiles]);

  const getMealTypesForDate = (value: Date) =>
    getMealTypeDefinitionsForDate(value, mealTypeProfiles);

  const findMealTypeDefinition = (mealType: string, value: Date) =>
    getMealTypesForDate(value).find((definition) => definition.slug === mealType) ?? null;

  useEffect(() => {
    if (view === "month") {
      setIsDraggingMeal(false);
    }

    const handleDragStart = (event: DragEvent) => {
      if (view === "month") {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const isMealCard =
        target.closest(`.${styles.timelineMealCard}`) ||
        target.closest(`.${styles.weekSlotMealCard}`);

      if (isMealCard) {
        setIsDraggingMeal(true);
        setDragging(true);
      }
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
  }, [view, setDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMeal || trashPendingMeal) return;

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
  }, [editMeal, trashPendingMeal, undo, redo]);

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

  const patchMeal = async (
    mealId: string,
    changes: Partial<Pick<EditableMeal, "date" | "type">>
  ) => {
    const payload: {
      date?: string;
      mealType?: ReturnType<typeof fromCalendarMealType>;
      mealTypeDefinitionId?: string | null;
    } = {};

    if (changes.date) {
      payload.date = normalizeMealDate(changes.date).toISOString();
    }

    if (changes.type) {
      const effectiveDate = changes.date ?? meals.find((meal) => meal.id === mealId)?.date ?? date;
      payload.mealType = fromCalendarMealType(changes.type);
      payload.mealTypeDefinitionId =
        findMealTypeDefinition(changes.type, effectiveDate)?.id ?? null;
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${mealId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
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

    const targetDefinition = findMealTypeDefinition(targetType, normalizedTargetDate);

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
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
    }
  };

  const onSwapMeals = async (draggedMeal: EditableMeal, targetMeal: EditableMeal) => {
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
      return;
    }

    const previousMeals = updateMealsCache((current) =>
      current.map((currentMeal) => {
        if (currentMeal.id === draggedMeal.id) {
          const nextDefinition = findMealTypeDefinition(targetMeal.type, targetSourceDate);
          return {
            ...currentMeal,
            date: targetSourceDate,
            type: targetMeal.type,
            mealTypeDefinitionId: nextDefinition?.id ?? null,
            mealTypeDefinition: nextDefinition,
          };
        }

        if (currentMeal.id === targetMeal.id) {
          const nextDefinition = findMealTypeDefinition(draggedMeal.type, draggedSourceDate);
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
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
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
  };

  const closeSaveAsRecipeFlow = () => {
    setSaveAsRecipeConflict(null);
    setSaveAsRecipeMeal(null);
  };

  const handleSaveRecipeFromMeal = async (input: CreateRecipeInput) => {
    if (!saveAsRecipeMeal) return;
    const recipe = await createRecipeMutation.mutateAsync(input);

    // Link the meal back to the new recipe if it has been persisted
    if (saveAsRecipeMeal.id) {
      await fetchJson<{ data: CalendarMeal }>(`/api/meals/${saveAsRecipeMeal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ recipeId: recipe.id, cuisine: recipe.cuisine }),
      });
      await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
    }

    closeSaveAsRecipeFlow();
    toast({
      title: `Saved "${recipe.title}" to Recipe Book`,
      description: saveAsRecipeMeal.id
        ? "This meal is now linked to the recipe."
        : undefined,
      duration: 5000,
    });
  };

  const handleLinkExistingRecipe = async () => {
    if (!saveAsRecipeMeal?.id || !saveAsRecipeConflict) {
      return;
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${saveAsRecipeMeal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        recipeId: saveAsRecipeConflict.existing.id,
        cuisine: saveAsRecipeConflict.existing.cuisine ?? null,
      }),
    });
    await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });

    const existingTitle = saveAsRecipeConflict.existing.title;
    closeSaveAsRecipeFlow();
    toast({
      title: `Linked to "${existingTitle}"`,
      description: "This meal now points to the existing recipe.",
      duration: 5000,
    });
  };

  const handleUnlinkRecipe = async (meal: EditableMeal) => {
    if (!meal.id || !meal.linkedRecipe) return;

    // Copy recipe data into standalone meal fields, then clear the link
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
                  mealTypeDefinitions.find((definition) => definition.enabled)?.slug ??
                    mealTypeDefinitions[0]?.slug ??
                    "DINNER",
                  mealTypeDefinitions.find((definition) => definition.enabled) ??
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

      <div className={styles.calCard}>
        {view === "day" ? (
          <DayView
            date={date}
            meals={meals}
            mealTypeProfiles={mealTypeProfiles}
            highlightedProfileId={highlightedProfileId}
            onEdit={setEditMeal}
            onMoveMeal={onMoveMeal}
            onSwapMeals={onSwapMeals}
            setDate={setDate}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            date={date}
            meals={meals}
            mealTypeProfiles={mealTypeProfiles}
            highlightedProfileId={highlightedProfileId}
            onEdit={setEditMeal}
            onMoveMeal={onMoveMeal}
            onSwapMeals={onSwapMeals}
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
            setDate={setDate}
          />
        ) : null}
      </div>

      <TrashDropZone
        visible={isDraggingMeal}
        onDropMeal={onTrashDropMeal}
      />

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
              <h2 className={styles.legendTitle}>{`Meal types for ${profile.name}`}</h2>
              <p className={styles.legendHint}>
                {profile.rangeLabel ?? "Shown for the selected date range."}
              </p>
            </div>
            <div className={styles.legend}>
              {profile.mealTypes
                .filter((definition) => definition.enabled)
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((definition) => {
                  const config = getTypeConfig(definition.slug, profile.mealTypes);

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
          mealTypeProfiles={mealTypeProfiles}
          onClose={() => setEditMeal(null)}
          onDelete={onDeleteMeal}
          onResuggest={onResuggest}
          onSave={onSaveMeal}
          onSaveAsRecipe={handleSaveAsRecipe}
          onUnlinkRecipe={handleUnlinkRecipe}
        />
      ) : null}

      {saveAsRecipeMeal ? (
        <AddRecipeModal
          open
          initialRecipe={mealToRecipePayload(saveAsRecipeMeal)}
          isSaving={createRecipeMutation.isPending}
          onClose={closeSaveAsRecipeFlow}
          onConflict={handleSaveRecipeConflict}
          onSave={handleSaveRecipeFromMeal}
        />
      ) : null}

      <AlertDialog
        open={Boolean(saveAsRecipeConflict)}
        onOpenChange={(open) => {
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
                : `"${saveAsRecipeConflict?.existing.title ?? "This recipe"}" is already in your Recipe Book.`} You can link this meal to the existing recipe, or keep editing and rename the draft before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              className={styles.btnGhost}
              onClick={() => setSaveAsRecipeConflict(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.btnLinkRecipe}
              onClick={() => setSaveAsRecipeConflict(null)}
              type="button"
            >
              Rename Draft
            </button>
            <button
              className={styles.btnSave}
              disabled={!saveAsRecipeMeal?.id}
              onClick={() => {
                void handleLinkExistingRecipe();
              }}
              type="button"
            >
              Link Existing
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
