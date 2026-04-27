import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import type { CalendarMeal } from "@/lib/calendar";
import { useToast } from "@/components/providers/toast-provider";
import type { MealIngredient } from "@shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MealSnapshot = {
  name: string;
  date: string;
  mealType: string;
  notes: string | null;
  ingredients: MealIngredient[];
  description?: string | null;
  cuisine?: string | null;
  instructions?: string[];
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  servingsOverride?: number | null;
  recipeId?: string | null;
};

type AddAction = {
  type: "add";
  mealId: string;
  snapshot: MealSnapshot;
  summary: string;
};

type DeleteAction = {
  type: "delete";
  mealId: string;
  snapshot: MealSnapshot;
  summary: string;
};

type MoveAction = {
  type: "move";
  mealId: string;
  fromDate: string;
  fromType: string;
  toDate: string;
  toType: string;
  summary: string;
};

type SwapAction = {
  type: "swap";
  meal1Id: string;
  meal1Date: string;
  meal1Type: string;
  meal2Id: string;
  meal2Date: string;
  meal2Type: string;
  summary: string;
};

export type MealUndoAction = AddAction | DeleteAction | MoveAction | SwapAction;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export const MAX_STACK_SIZE = 50;

/**
 * Scan every action in `stack` and replace references to `oldId` with `newId`.
 * Mutates in place.
 */
export function rebindMealId(
  stack: MealUndoAction[],
  oldId: string,
  newId: string,
): void {
  for (const action of stack) {
    switch (action.type) {
      case "add":
      case "delete":
        if (action.mealId === oldId) action.mealId = newId;
        break;
      case "move":
        if (action.mealId === oldId) action.mealId = newId;
        break;
      case "swap":
        if (action.meal1Id === oldId) action.meal1Id = newId;
        if (action.meal2Id === oldId) action.meal2Id = newId;
        break;
    }
  }
}

/**
 * Remove the most-recent action whose `.type` matches `type`.
 * Returns `true` if an action was removed, `false` otherwise.
 * Mutates in place.
 */
export function discardLastOfType(
  stack: MealUndoAction[],
  type: MealUndoAction["type"],
): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === type) {
      stack.splice(i, 1);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Module-level API helpers
// ---------------------------------------------------------------------------

function createMealApi(snapshot: MealSnapshot) {
  return fetchJson<{ data: CalendarMeal }>("/api/meals", {
    method: "POST",
    body: JSON.stringify({
      name: snapshot.name,
      date: snapshot.date,
      mealType: snapshot.mealType,
      notes: snapshot.notes,
      ingredients: snapshot.ingredients,
      description: snapshot.description,
      cuisine: snapshot.cuisine,
      instructions: snapshot.instructions,
      servings: snapshot.servings,
      prepTime: snapshot.prepTime,
      cookTime: snapshot.cookTime,
      servingsOverride: snapshot.servingsOverride,
      recipeId: snapshot.recipeId,
    }),
  });
}

function deleteMealApi(mealId: string) {
  return fetchJson(`/api/meals/${mealId}`, { method: "DELETE" });
}

function patchMealApi(
  mealId: string,
  body: { date?: string; mealType?: string },
) {
  return fetchJson(`/api/meals/${mealId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMealUndoRedo() {
  const undoStackRef = useRef<MealUndoAction[]>([]);
  const redoStackRef = useRef<MealUndoAction[]>([]);
  const isProcessingRef = useRef(false);
  const [, setRevision] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const invalidateMeals = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["meals"], exact: false }),
    [queryClient],
  );

  /** Push `action` onto the undo stack and clear the redo stack. */
  const recordAction = useCallback(
    (action: MealUndoAction) => {
      undoStackRef.current.push(action);
      if (undoStackRef.current.length > MAX_STACK_SIZE) {
        undoStackRef.current.splice(
          0,
          undoStackRef.current.length - MAX_STACK_SIZE,
        );
      }
      redoStackRef.current.length = 0;
      bump();
    },
    [bump],
  );

  /**
   * Discard the most-recent undo-stack entry whose `.type` matches `type`.
   * Used to prevent double-undo when the toast "Undo" button is clicked.
   */
  const discardLast = useCallback(
    (type: MealUndoAction["type"]) => {
      if (discardLastOfType(undoStackRef.current, type)) {
        bump();
      }
    },
    [bump],
  );

  // -------------------------------------------------------------------------
  // Undo
  // -------------------------------------------------------------------------

  const undo = useCallback(async () => {
    if (isProcessingRef.current) return;
    const action = undoStackRef.current.pop();
    if (!action) return;

    isProcessingRef.current = true;
    bump();

    try {
      switch (action.type) {
        case "add": {
          await deleteMealApi(action.mealId);
          redoStackRef.current.push(action);
          break;
        }
        case "delete": {
          const res = await createMealApi(action.snapshot);
          const oldId = action.mealId;
          const newId = res.data.id;
          action.mealId = newId;
          rebindMealId(redoStackRef.current, oldId, newId);
          redoStackRef.current.push(action);
          rebindMealId(undoStackRef.current, oldId, newId);
          break;
        }
        case "move": {
          await patchMealApi(action.mealId, {
            date: action.fromDate,
            mealType: action.fromType,
          });
          redoStackRef.current.push(action);
          break;
        }
        case "swap": {
          await Promise.all([
            patchMealApi(action.meal1Id, {
              date: action.meal1Date,
              mealType: action.meal1Type,
            }),
            patchMealApi(action.meal2Id, {
              date: action.meal2Date,
              mealType: action.meal2Type,
            }),
          ]);
          redoStackRef.current.push(action);
          break;
        }
      }

      await invalidateMeals();
      toast({ title: `Undid: ${action.summary}`, duration: 3_000 });
    } catch {
      // Restore action to undo stack on failure so the user can retry.
      undoStackRef.current.push(action);
      toast({
        title: "Undo failed",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      isProcessingRef.current = false;
      bump();
    }
  }, [bump, invalidateMeals, toast]);

  // -------------------------------------------------------------------------
  // Redo
  // -------------------------------------------------------------------------

  const redo = useCallback(async () => {
    if (isProcessingRef.current) return;
    const action = redoStackRef.current.pop();
    if (!action) return;

    isProcessingRef.current = true;
    bump();

    try {
      switch (action.type) {
        case "add": {
          const res = await createMealApi(action.snapshot);
          const oldId = action.mealId;
          const newId = res.data.id;
          action.mealId = newId;
          rebindMealId(undoStackRef.current, oldId, newId);
          undoStackRef.current.push(action);
          rebindMealId(redoStackRef.current, oldId, newId);
          break;
        }
        case "delete": {
          await deleteMealApi(action.mealId);
          undoStackRef.current.push(action);
          break;
        }
        case "move": {
          await patchMealApi(action.mealId, {
            date: action.toDate,
            mealType: action.toType,
          });
          undoStackRef.current.push(action);
          break;
        }
        case "swap": {
          await Promise.all([
            patchMealApi(action.meal1Id, {
              date: action.meal2Date,
              mealType: action.meal2Type,
            }),
            patchMealApi(action.meal2Id, {
              date: action.meal1Date,
              mealType: action.meal1Type,
            }),
          ]);
          undoStackRef.current.push(action);
          break;
        }
      }

      await invalidateMeals();
      toast({ title: `Redid: ${action.summary}`, duration: 3_000 });
    } catch {
      // Restore action to redo stack on failure so the user can retry.
      redoStackRef.current.push(action);
      toast({
        title: "Redo failed",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      isProcessingRef.current = false;
      bump();
    }
  }, [bump, invalidateMeals, toast]);

  return {
    recordAction,
    discardLast,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0 && !isProcessingRef.current,
    canRedo: redoStackRef.current.length > 0 && !isProcessingRef.current,
  };
}
