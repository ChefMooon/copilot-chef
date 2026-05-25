import { useEffect, useRef, useState, type DragEvent } from "react";

import {
  getMealPlanDragPayload,
  setMealPlanDragPayload,
  type BankMeal,
  type CalendarMealType,
} from "@/lib/calendar";
import type { MealTypeDefinitionPayload } from "@shared/types";

import styles from "./meal-plan.module.css";

export type MealBankPlacement = "left" | "right" | "bottom";

type MealBankSidecarProps = {
  activeDate: Date;
  collapsed: boolean;
  dragDisabled?: boolean;
  error?: unknown;
  isCalendarMealDragging?: boolean;
  isLoading: boolean;
  mealTypes: MealTypeDefinitionPayload[];
  meals: BankMeal[];
  placement: MealBankPlacement;
  onAddCustomMeal: () => void;
  onAddFromRecipe: () => void;
  onDelete: (meal: BankMeal) => void;
  onDuplicate: (meal: BankMeal) => void;
  onDropMealToBank: (mealId: string) => Promise<void>;
  onEdit: (meal: BankMeal) => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onSchedule: (meal: BankMeal, mealType: CalendarMealType) => Promise<void>;
  onToggleCollapsed: (collapsed: boolean) => void;
};

function formatActiveDate(date: Date) {
  return date.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
}

export function MealBankSidecar({
  activeDate,
  collapsed,
  dragDisabled = false,
  error,
  isCalendarMealDragging = false,
  isLoading,
  mealTypes,
  meals,
  placement,
  onAddCustomMeal,
  onAddFromRecipe,
  onDelete,
  onDuplicate,
  onDropMealToBank,
  onEdit,
  onReorder,
  onSchedule,
  onToggleCollapsed,
}: MealBankSidecarProps) {
  const [dropActive, setDropActive] = useState(false);
  const [hoverOpening, setHoverOpening] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const enabledMealTypes = mealTypes.filter((mealType) => mealType.enabled);
  const targetDateLabel = formatActiveDate(activeDate);
  const placementClass =
    placement === "left"
      ? styles.mealBankLeft
      : placement === "bottom"
        ? styles.mealBankBottom
        : styles.mealBankRight;
  const useVerticalTabLabel = collapsed && placement !== "bottom";

  const clearHoverOpenTimer = () => {
    if (hoverOpenTimerRef.current === null) {
      return;
    }

    window.clearTimeout(hoverOpenTimerRef.current);
    hoverOpenTimerRef.current = null;
    setHoverOpening(false);
  };

  useEffect(() => clearHoverOpenTimer, []);

  useEffect(() => {
    if (!showAddMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node | null)) {
        setShowAddMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAddMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAddMenu]);

  useEffect(() => {
    if (!isCalendarMealDragging) {
      setDropActive(false);
      clearHoverOpenTimer();
    }
  }, [isCalendarMealDragging]);

  useEffect(() => {
    if (collapsed) {
      setShowAddMenu(false);
    }
  }, [collapsed]);

  const moveMeal = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= meals.length) {
      return;
    }

    const nextMeals = [...meals];
    const [movedMeal] = nextMeals.splice(fromIndex, 1);
    if (!movedMeal) {
      return;
    }

    nextMeals.splice(toIndex, 0, movedMeal);
    await onReorder(nextMeals.map((meal) => meal.id));
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (dragDisabled || !isCalendarMealDragging) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropActive(true);

    if (!collapsed || hoverOpenTimerRef.current !== null) {
      return;
    }

    setHoverOpening(true);
    hoverOpenTimerRef.current = window.setTimeout(() => {
      hoverOpenTimerRef.current = null;
      setHoverOpening(false);
      onToggleCollapsed(false);
    }, 450);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    clearHoverOpenTimer();

    const payload = getMealPlanDragPayload(event.dataTransfer);
    if (!payload || payload.kind !== "meal") {
      return;
    }

    await onDropMealToBank(payload.mealId);
  };

  return (
    <aside
      className={`${styles.mealBank} ${placementClass} ${collapsed ? styles.mealBankCollapsed : styles.mealBankOpen} ${dropActive ? styles.mealBankDropActive : ""} ${hoverOpening ? styles.mealBankHoverOpening : ""}`}
      onDragEnd={() => {
        setDropActive(false);
        clearHoverOpenTimer();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setDropActive(false);
        clearHoverOpenTimer();
      }}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        void handleDrop(event);
      }}
    >
      <button
        aria-label="Toggle Meal Bank drawer"
        className={`${styles.mealBankTab} ${useVerticalTabLabel ? styles.mealBankTabVertical : ""}`}
        onClick={() => onToggleCollapsed(!collapsed)}
        type="button"
      >
        <span className={styles.mealBankTabLabel}>MEALS</span>
        <strong className={styles.mealBankTabCount}>{meals.length}</strong>
      </button>

      {collapsed ? null : (
        <div className={styles.mealBankPanel}>
          <div className={styles.mealBankHeader}>
            <div>
              <h2 className={styles.mealBankTitle}>Meal Bank</h2>
              <p className={styles.mealBankDescription}>
                Hold meals off-calendar. Drop planned meals here or schedule banked meals onto {targetDateLabel}.
              </p>
            </div>
            <div className={styles.mealBankHeaderActions} ref={addMenuRef}>
              <button
                aria-expanded={showAddMenu}
                aria-haspopup="menu"
                aria-label="Add a meal to the Meal Bank"
                className={styles.mealBankAddButton}
                onClick={() => setShowAddMenu((open) => !open)}
                type="button"
              >
                <span className={styles.mealBankAddGlyph}>+</span>
              </button>
              {showAddMenu ? (
                <div className={styles.mealBankAddMenu} role="menu">
                  <button
                    className={styles.mealBankAddMenuItem}
                    onClick={() => {
                      setShowAddMenu(false);
                      onAddCustomMeal();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Custom Meal
                  </button>
                  <button
                    className={styles.mealBankAddMenuItem}
                    onClick={() => {
                      setShowAddMenu(false);
                      onAddFromRecipe();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    From Recipe
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className={styles.mealBankEmpty}>Loading banked meals...</div>
          ) : error ? (
            <div className={styles.mealBankEmpty}>Unable to load the Meal Bank.</div>
          ) : meals.length === 0 ? (
            <div className={styles.mealBankEmpty}>
              Drag a meal here to remove it from the calendar without deleting it.
            </div>
          ) : (
            <div className={styles.mealBankList}>
              {meals.map((meal, index) => (
                <article className={styles.mealBankCard} key={meal.id}>
                  <button
                    className={styles.mealBankCardMain}
                    draggable={!dragDisabled}
                    onClick={() => onEdit(meal)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setMealPlanDragPayload(event.dataTransfer, {
                        kind: "bank-meal",
                        mealId: meal.id,
                      });
                    }}
                    type="button"
                  >
                    <span className={styles.mealBankMealName}>{meal.name}</span>
                    {meal.cuisine ? (
                      <span className={styles.mealBankMealMeta}>{meal.cuisine}</span>
                    ) : null}
                    {meal.notes ? (
                      <span className={styles.mealBankMealNotes}>{meal.notes}</span>
                    ) : null}
                  </button>
                  <div className={styles.mealBankActions}>
                    <button
                      className={styles.mealBankIconButton}
                      disabled={index === 0}
                      onClick={() => {
                        void moveMeal(index, index - 1);
                      }}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className={styles.mealBankIconButton}
                      disabled={index === meals.length - 1}
                      onClick={() => {
                        void moveMeal(index, index + 1);
                      }}
                      type="button"
                    >
                      Down
                    </button>
                    <button
                      className={styles.mealBankIconButton}
                      onClick={() => onEdit(meal)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.mealBankIconButton}
                      onClick={() => onDuplicate(meal)}
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      className={styles.mealBankIconButton}
                      onClick={() => onDelete(meal)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <div className={styles.mealBankScheduleRow}>
                    {enabledMealTypes.map((mealType) => (
                      <button
                        className={styles.mealBankScheduleButton}
                        key={mealType.id}
                        onClick={() => {
                          void onSchedule(meal, mealType.slug);
                        }}
                        style={{ borderColor: mealType.color, color: mealType.color }}
                        type="button"
                      >
                        {mealType.name}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}