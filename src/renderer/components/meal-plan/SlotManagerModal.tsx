import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, DotsSixVertical, Plus } from "@phosphor-icons/react";

import {
  getTypeConfig,
  type CalendarMealType,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeDefinitionPayload } from "@shared/types";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/button";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

import styles from "./meal-plan.module.css";

type SlotManagerModalProps = {
  slotMeals: EditableMeal[];
  slotDate: Date;
  slotType: CalendarMealType;
  mealTypeDefinition: MealTypeDefinitionPayload | null;
  onClose: (didMutate: boolean) => void;
  onEdit: (meal: EditableMeal) => void;
  onDelete: (mealId: string) => Promise<void>;
  onAddMeal: () => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function SlotManagerModal({
  slotMeals,
  slotDate,
  slotType,
  mealTypeDefinition,
  onClose,
  onEdit,
  onDelete,
  onAddMeal,
  onReorder,
}: SlotManagerModalProps) {
  const [localMeals, setLocalMeals] = useState(slotMeals);
  const [draggedMealId, setDraggedMealId] = useState<string | null>(null);
  const [dropTargetMealId, setDropTargetMealId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [didMutate, setDidMutate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealPendingDelete, setMealPendingDelete] = useState<EditableMeal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  useEffect(() => {
    setLocalMeals(slotMeals);
  }, [slotMeals]);

  const typeConfig = useMemo(
    () => getTypeConfig(slotType, mealTypeDefinition ? [mealTypeDefinition] : []),
    [mealTypeDefinition, slotType]
  );

  const applyOrderedMeals = async (nextMeals: EditableMeal[]) => {
    const previousMeals = localMeals;
    setLocalMeals(nextMeals);
    setIsReordering(true);
    setError(null);

    try {
      await onReorder(nextMeals.map((meal) => meal.id));
      setDidMutate(true);

      const firstMeal = nextMeals[0];
      if (firstMeal) {
        setLiveAnnouncement(
          `${firstMeal.name} is now first in ${typeConfig.label.toLowerCase()} for ${slotDate.toLocaleDateString("default", {
            month: "short",
            day: "numeric",
          })}.`
        );
      }
    } catch (reorderError) {
      setLocalMeals(previousMeals);
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : "Couldn't save order. Please try again."
      );
    } finally {
      setIsReordering(false);
      setDraggedMealId(null);
      setDropTargetMealId(null);
    }
  };

  const moveMealByOffset = async (mealId: string, offset: -1 | 1) => {
    const currentIndex = localMeals.findIndex((meal) => meal.id === mealId);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= localMeals.length) {
      return;
    }

    await applyOrderedMeals(moveItem(localMeals, currentIndex, nextIndex));
  };

  const handleRowKeyDown = async (
    event: React.KeyboardEvent<HTMLDivElement>,
    mealId: string
  ) => {
    if (!event.shiftKey || isReordering) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      await moveMealByOffset(mealId, -1);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      await moveMealByOffset(mealId, 1);
    }
  };

  const handleDropOnMeal = async (targetMealId: string) => {
    if (!draggedMealId || draggedMealId === targetMealId || isReordering) {
      return;
    }

    const fromIndex = localMeals.findIndex((meal) => meal.id === draggedMealId);
    const toIndex = localMeals.findIndex((meal) => meal.id === targetMealId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    await applyOrderedMeals(moveItem(localMeals, fromIndex, toIndex));
  };

  const confirmDelete = async () => {
    if (!mealPendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(undefined);

    try {
      await onDelete(mealPendingDelete.id);
      setDidMutate(true);
      const nextMeals = localMeals.filter((meal) => meal.id !== mealPendingDelete.id);
      setLocalMeals(nextMeals);
      setMealPendingDelete(null);

      if (nextMeals.length === 0) {
        onClose(true);
      }
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "Unable to delete meal. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ModalShell
        ariaLabel="Manage slot meals"
        bodyClassName={styles.slotManagerBody}
        className={styles.slotManagerPanel}
        closeLabel="Close slot manager"
        onClose={() => {
          if (draggedMealId) {
            setDraggedMealId(null);
            setDropTargetMealId(null);
            setLocalMeals(slotMeals);
            return;
          }
          onClose(didMutate);
        }}
        open={!mealPendingDelete}
        eyebrow={typeConfig.label}
        title={slotDate.toLocaleDateString("default", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        footerRight={
          <Button onClick={onAddMeal} type="button" variant="accent">
            <Plus aria-hidden="true" size={18} weight="regular" />
            Add Meal
          </Button>
        }
      >

          <div aria-live="polite" className={styles.slotManagerLiveRegion}>
            {liveAnnouncement}
          </div>

          {localMeals.length === 0 ? (
              <p className={styles.slotManagerEmpty}>No meals in this slot yet.</p>
            ) : (
              <div className={styles.slotManagerList} role="list">
                {localMeals.map((meal, index) => {
                  const isFirst = index === 0;
                  const isLast = index === localMeals.length - 1;

                  return (
                    <div
                      className={`${styles.slotManagerRow} ${draggedMealId === meal.id ? styles.slotManagerRowDragging : ""} ${dropTargetMealId === meal.id ? styles.slotManagerRowDropTarget : ""}`}
                      key={meal.id}
                      onKeyDown={(event) => void handleRowKeyDown(event, meal.id)}
                      role="listitem"
                      tabIndex={0}
                      style={{ borderLeftColor: typeConfig.dot }}
                    >
                      <button
                        className={styles.slotManagerDragHandle}
                        disabled={isReordering}
                        draggable={!isReordering}
                        onDragEnd={() => {
                          setDraggedMealId(null);
                          setDropTargetMealId(null);
                        }}
                        onDragOver={(event) => {
                          if (!draggedMealId || draggedMealId === meal.id || isReordering) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropTargetMealId(meal.id);
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", meal.id);

                          const rowElement = event.currentTarget.parentElement;
                          if (rowElement) {
                            const rect = rowElement.getBoundingClientRect();
                            const offsetX = Math.max(0, event.clientX - rect.left);
                            const offsetY = Math.max(0, event.clientY - rect.top);
                            event.dataTransfer.setDragImage(rowElement, offsetX, offsetY);
                          }

                          setDraggedMealId(meal.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleDropOnMeal(meal.id);
                        }}
                        aria-label={`Drag ${meal.name} to reorder`}
                        title="Drag to reorder"
                        type="button"
                      >
                        <DotsSixVertical aria-hidden="true" size={18} weight="regular" />
                      </button>

                      <div className={styles.slotManagerMealCopy}>
                        <span className={styles.slotManagerMealName}>{meal.name}</span>
                        {meal.notes ? (
                          <span className={styles.slotManagerMealMeta}>{meal.notes}</span>
                        ) : null}
                      </div>

                      <div className={styles.slotManagerArrows}>
                        {!isFirst ? (
                          <button
                            className={styles.slotManagerArrowBtn}
                            aria-label={`Move ${meal.name} up`}
                            disabled={isReordering}
                            onClick={() => void moveMealByOffset(meal.id, -1)}
                            type="button"
                          >
                            <ArrowUp aria-hidden="true" size={18} weight="regular" />
                          </button>
                        ) : null}
                        {!isLast ? (
                          <button
                            className={styles.slotManagerArrowBtn}
                            aria-label={`Move ${meal.name} down`}
                            disabled={isReordering}
                            onClick={() => void moveMealByOffset(meal.id, 1)}
                            type="button"
                          >
                            <ArrowDown aria-hidden="true" size={18} weight="regular" />
                          </button>
                        ) : null}
                      </div>

                      <button
                        className={styles.btnGhost}
                        disabled={isReordering}
                        onClick={() => onEdit(meal)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className={styles.btnDelete}
                        disabled={isReordering}
                        onClick={() => {
                          setDeleteError(undefined);
                          setMealPendingDelete(meal);
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          {error ? <div className={styles.slotManagerError}>{error}</div> : null}
      </ModalShell>

      {mealPendingDelete ? (
        <DeleteConfirmationModal
          error={deleteError}
          isLoading={isDeleting}
          isOpen
          mealName={mealPendingDelete.name}
          onCancel={() => {
            if (isDeleting) {
              return;
            }

            setDeleteError(undefined);
            setMealPendingDelete(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </>
  );
}