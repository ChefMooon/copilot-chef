import { useEffect, useState } from "react";

import styles from "./settings.module.css";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/button";

const PRESET_COLORS = [
  "#E8885A",
  "#C5A84B",
  "#5A7D63",
  "#8A7DB8",
  "#8FB7D4",
  "#B45E4A",
  "#4D8B8F",
  "#A85774",
  "#6A7C91",
  "#7D9E4F",
  "#C06C3D",
  "#5571B6",
] as const;

type ProfileFormState = {
  id: string | null;
  name: string;
  color: string;
  description: string;
  priority: number;
  startDate: string;
  endDate: string;
};

type EditableMealTypeDraft = {
  id: string;
  definitionId: string | null;
  name: string;
  color: string;
  enabled: boolean;
  cutoffTime: string;
};

function ColorSwatches(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            aria-label={`Select ${color}`}
            className={`h-7 w-7 rounded-full border ${props.value === color ? "border-[3px] border-neutral-900" : "border-white/70"}`}
            onClick={() => props.onChange(color)}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          aria-label="Choose custom color"
          className="h-10 w-14 cursor-pointer rounded border border-[var(--cream-dark)] bg-transparent p-1"
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
          type="color"
          value={props.value}
        />
        <input
          aria-label="Color hex code"
          className={styles.select}
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
          placeholder="#E8885A"
          type="text"
          value={props.value}
        />
      </div>
    </div>
  );
}

type MealTypeProfileModalProps = {
  form: ProfileFormState;
  isDefaultProfile: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mealTypeDrafts: EditableMealTypeDraft[];
  onAddMealType: () => void;
  onClose: () => void;
  onMoveMealType: (draftId: string, direction: -1 | 1) => void;
  onRemoveMealType: (draftId: string) => void;
  onSave: () => Promise<void>;
  onUpdateForm: (patch: Partial<ProfileFormState>) => void;
  onUpdateMealType: (
    draftId: string,
    patch: Partial<Pick<EditableMealTypeDraft, "name" | "color" | "enabled" | "cutoffTime">>
  ) => void;
};

export function MealTypeProfileModal({
  form,
  isDefaultProfile,
  isOpen,
  isSaving,
  mealTypeDrafts,
  onAddMealType,
  onClose,
  onMoveMealType,
  onRemoveMealType,
  onSave,
  onUpdateForm,
  onUpdateMealType,
}: MealTypeProfileModalProps) {
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isOpen) {
      setError(undefined);
    }
  }, [isOpen, form.id]);

  if (!isOpen) {
    return null;
  }

  const isEditing = Boolean(form.id);
  const dialogLabel = isDefaultProfile
    ? "Update default meal type profile"
    : isEditing
      ? "Update custom meal type profile"
      : "Add custom meal type profile";

  const handleSave = async () => {
    setError(undefined);
    try {
      await onSave();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save meal type profile."
      );
    }
  };

  return (
    <ModalShell
      ariaLabel={dialogLabel}
      bodyClassName={`${styles.personaModalBody} ${styles.mealTypeProfileModalBody} flex-1 min-h-0 overflow-y-auto`}
      className={`${styles.personaModalPanel} ${styles.mealTypeProfileModalPanel} max-h-[90vh] min-h-0 w-full`}
      closeLabel="Close meal type profile dialog"
      closeDisabled={isSaving}
      onClose={onClose}
      open={isOpen}
      eyebrow={isDefaultProfile ? "Default Profile" : "Custom Profiles"}
      title={
        isDefaultProfile
          ? "Update Default Profile"
          : isEditing
            ? "Update Custom Profile"
            : "Add Custom Profile"
      }
      footerLeft={
        <Button
          disabled={isSaving}
          onClick={onClose}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      }
      footerRight={
        <button
          className="rounded-xl bg-[var(--green)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--green-light)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isSaving}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Update profile"
              : "Create profile"}
        </button>
      }
    >
          <p className={styles.cardDescription}>
            {isDefaultProfile
              ? "Tailor the everyday meal types used whenever no dated custom profile matches."
              : "Set an optional date range and priority for this custom meal plan profile, then tailor the meal types before saving."}
          </p>

          <div className={styles.twoColumn}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Profile name</label>
              <input
                aria-label="Profile name"
                autoFocus
                className={styles.select}
                onChange={(event) => onUpdateForm({ name: event.target.value })}
                placeholder="Ramadan"
                type="text"
                value={form.name}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Profile color</label>
              <ColorSwatches
                onChange={(value) => onUpdateForm({ color: value })}
                value={form.color}
              />
            </div>
            {!isDefaultProfile ? (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Start date</label>
                  <input
                    aria-label="Start date"
                    className={styles.select}
                    onChange={(event) =>
                      onUpdateForm({ startDate: event.target.value })
                    }
                    type="date"
                    value={form.startDate}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>End date</label>
                  <input
                    aria-label="End date"
                    className={styles.select}
                    onChange={(event) =>
                      onUpdateForm({ endDate: event.target.value })
                    }
                    type="date"
                    value={form.endDate}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Priority</label>
            <input
              aria-label="Priority"
              className={styles.select}
              onChange={(event) =>
                onUpdateForm({
                  priority: Number.parseInt(event.target.value || "0", 10),
                })
              }
              type="number"
              value={form.priority}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              aria-label="Description"
              className={styles.textarea}
              onChange={(event) =>
                onUpdateForm({ description: event.target.value })
              }
              placeholder="Use Suhoor and Iftar during Ramadan."
              value={form.description}
            />
          </div>

          <div className={styles.mealTypeProfileModalSection}>
            <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
              <h3 className={styles.cardTitle}>Meal Types</h3>
              <p className={styles.cardDescription}>
                {isDefaultProfile
                  ? "Add, edit, reorder, or remove default meal types before saving."
                  : "Add, edit, reorder, or remove meal types before saving this custom profile."}
              </p>
              <p className={styles.cardDescription}>
                Today's dashboard count includes a meal type through its cutoff time. The cutoff is a local wall-clock time for the scheduled date.
              </p>
            </div>

            <div className={styles.mealTypeProfileModalList}>
              {mealTypeDrafts.map((draft) => (
                <div className={styles.mealTypeProfileDraftCard} key={draft.id}>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: draft.color }}
                    />
                    <input
                      aria-label="Meal type name"
                      className={styles.select}
                      onChange={(event) =>
                        onUpdateMealType(draft.id, { name: event.target.value })
                      }
                      placeholder="Iftar"
                      type="text"
                      value={draft.name}
                    />
                  </div>

                  <ColorSwatches
                    onChange={(value) =>
                      onUpdateMealType(draft.id, { color: value })
                    }
                    value={draft.color}
                  />

                  <label className={styles.fieldLabel}>
                    Dashboard cutoff
                    <input
                      aria-label="Meal type cutoff time"
                      className={styles.select}
                      onChange={(event) =>
                        onUpdateMealType(draft.id, {
                          cutoffTime: event.target.value,
                        })
                      }
                      type="time"
                      value={draft.cutoffTime}
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                    <input
                      checked={draft.enabled}
                      onChange={(event) =>
                        onUpdateMealType(draft.id, {
                          enabled: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Enabled in planner
                  </label>

                  <div className={styles.actionsRow}>
                    <button
                      className="rounded-xl border border-[var(--border)] px-3 py-2 font-semibold"
                      onClick={() => onMoveMealType(draft.id, -1)}
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      className="rounded-xl border border-[var(--border)] px-3 py-2 font-semibold"
                      onClick={() => onMoveMealType(draft.id, 1)}
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      className="rounded-xl border border-[rgba(157,43,43,0.28)] px-4 py-2 font-semibold text-[#9D2B2B]"
                      onClick={() => onRemoveMealType(draft.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.actionsRow}>
              <button
                className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold"
                onClick={onAddMealType}
                type="button"
              >
                Add meal type
              </button>
            </div>
          </div>

          {error ? <p className={styles.personaModalError}>{error}</p> : null}
    </ModalShell>
  );
}
