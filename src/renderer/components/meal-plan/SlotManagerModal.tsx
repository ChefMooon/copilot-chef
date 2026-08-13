import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, DotsSixVertical, X, Plus } from "@phosphor-icons/react";

import {
  getTypeConfig,
  type CalendarMealType,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeDefinitionPayload } from "@shared/types";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

import styles from "./meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
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
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    setLocalMeals(slotMeals);
  }, [slotMeals]);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (draggedMealId) {
          setDraggedMealId(null);
          setDropTargetMealId(null);
          setLocalMeals(slotMeals);
          return;
        }

        if (mealPendingDelete) {
          setMealPendingDelete(null);
          return;
        }

        onClose(didMutate);
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [didMutate, draggedMealId, mealPendingDelete, onClose, slotMeals]);

  useEffect(() => {
    if (!portalRoot || mealPendingDelete) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[data-autofocus='true']") ??
      getFocusable()[0] ??
      panel;
    initialTarget.focus();

    const tabHandler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", tabHandler);
    return () => {
      window.removeEventListener("keydown", tabHandler);
      previousFocus?.focus();
    };
  }, [mealPendingDelete, portalRoot]);

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

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <>
      <div
        className={styles.slotManagerOverlay}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose(didMutate);
          }
        }}
        ref={overlayRef}
      >
        <div
          className={styles.slotManagerPanel}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-manager-title"
          tabIndex={-1}
        >
          <div className={styles.slotManagerHeader}>
            <div className={styles.modalHeaderLeft}>
              <span className={styles.eyebrow}>{typeConfig.label}</span>
              <h2 className={styles.slotManagerTitle} id="slot-manager-title" tabIndex={-1}>
                {slotDate.toLocaleDateString("default", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
            </div>
            <button
              aria-label="Close slot manager"
              className={styles.modalClose}
              data-autofocus="true"
              onClick={() => onClose(didMutate)}
              type="button"
            >
              <X aria-hidden="true" size={18} weight="regular" />
            </button>
          </div>

          <div aria-live="polite" className={styles.slotManagerLiveRegion}>
            {liveAnnouncement}
          </div>

          <div className={styles.slotManagerBody}>
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
          </div>

          {error ? <div className={styles.slotManagerError}>{error}</div> : null}

          <div className={styles.slotManagerFooter}>
            <button className={styles.btnAddMeal} onClick={onAddMeal} type="button">
              <Plus aria-hidden="true" size={18} weight="regular" />
              <span>Add Meal</span>
            </button>
          </div>
        </div>
      </div>

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
    </>,
    portalRoot
  );
}