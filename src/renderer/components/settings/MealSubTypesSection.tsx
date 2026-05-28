import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMealSubTypeDefinition,
  deleteMealSubTypeDefinition,
  listMealSubTypeDefinitions,
  reorderMealSubTypeDefinitions,
  updateMealSubTypeDefinition,
} from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { useToast } from "@/components/providers/toast-provider";
import styles from "@/components/settings/settings.module.css";

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

const mealSubTypesQueryKey = ["meal-sub-types"] as const;

type MealSubTypeDraft = {
  id: string;
  definitionId: string | null;
  name: string;
  color: string;
  enabled: boolean;
};

function createDraftId() {
  return `meal-sub-type-draft-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDraft(input?: {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}): MealSubTypeDraft {
  return {
    id: createDraftId(),
    definitionId: input?.id ?? null,
    name: input?.name ?? "",
    color: input?.color ?? PRESET_COLORS[0],
    enabled: input?.enabled ?? true,
  };
}

function isValidHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

function ColorSwatches(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const colorInputValue = isValidHexColor(props.value)
    ? props.value
    : PRESET_COLORS[0];

  return (
    <div className={styles.subTypeColorPicker}>
      <div className={styles.subTypeColorInputs}>
        <input
          aria-label="Choose custom color"
          className={styles.colorInput}
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
          type="color"
          value={colorInputValue}
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
      <div className={styles.subTypeSwatchRow}>
        {PRESET_COLORS.map((color) => (
          <button
            aria-label={`Select ${color}`}
            aria-pressed={props.value === color}
            className={`${styles.subTypeSwatch} ${props.value === color ? styles.subTypeSwatchActive : ""}`}
            key={color}
            onClick={() => props.onChange(color)}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

export function MealSubTypesSection() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<MealSubTypeDraft[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const subTypesQuery = useQuery({
    queryKey: mealSubTypesQueryKey,
    enabled: apiReady,
    queryFn: listMealSubTypeDefinitions,
  });

  const definitions = subTypesQuery.data ?? [];

  useEffect(() => {
    if (!subTypesQuery.data || isDirty) {
      return;
    }

    setDrafts(subTypesQuery.data.map((definition) => buildDraft(definition)));
  }, [isDirty, subTypesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (nextDrafts: MealSubTypeDraft[]) => {
      const normalizedDrafts = nextDrafts.map((draft) => ({
        ...draft,
        name: draft.name.trim(),
        color: draft.color.trim().toUpperCase(),
      }));

      if (normalizedDrafts.length === 0) {
        throw new Error("Keep at least one meal sub-type.");
      }

      if (normalizedDrafts.some((draft) => !draft.name)) {
        throw new Error("Each meal sub-type needs a name.");
      }

      const removedDefinitionIds = new Set(
        definitions
          .filter(
            (definition) =>
              !normalizedDrafts.some(
                (draft) => draft.definitionId === definition.id
              )
          )
          .map((definition) => definition.id)
      );

      for (const definitionId of removedDefinitionIds) {
        await deleteMealSubTypeDefinition(definitionId);
      }

      const orderedIds: string[] = [];

      for (const draft of normalizedDrafts) {
        if (draft.definitionId) {
          await updateMealSubTypeDefinition(draft.definitionId, {
            name: draft.name,
            color: draft.color,
            enabled: draft.enabled,
          });
          orderedIds.push(draft.definitionId);
          continue;
        }

        const created = await createMealSubTypeDefinition({
          name: draft.name,
          color: draft.color,
          enabled: draft.enabled,
        });
        orderedIds.push(created.id);
      }

      await reorderMealSubTypeDefinitions(orderedIds);
    },
    onSuccess: async () => {
      setIsDirty(false);
      await queryClient.invalidateQueries({ queryKey: mealSubTypesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: ["meals"],
        exact: false,
      });
      toast({ title: "Meal sub-types saved." });
    },
    onError: (error) => {
      toast({
        title: "Could not save meal sub-types.",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    },
  });

  const updateDraft = (
    draftId: string,
    patch: Partial<Pick<MealSubTypeDraft, "name" | "color" | "enabled">>
  ) => {
    setIsDirty(true);
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...patch } : draft
      )
    );
  };

  const moveDraft = (draftId: string, direction: -1 | 1) => {
    setIsDirty(true);
    setDrafts((current) => {
      const index = current.findIndex((draft) => draft.id === draftId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = current.slice();
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const addDraft = () => {
    setIsDirty(true);
    setDrafts((current) => [...current, buildDraft()]);
  };

  const removeDraft = (draftId: string) => {
    setIsDirty(true);
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  return (
    <CollapsibleSection id="meal-sub-types" label="Meal Sub-Types">
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Sub-type options</h2>
          </div>
          <p className={styles.cardDescription}>
            Manage global meal sub-types (for example appetizer, main, dessert)
            and choose colors for each label.
          </p>
        </div>

        {subTypesQuery.isLoading ? (
          <div className={styles.cardDescription}>Loading sub-types…</div>
        ) : (
          <div className="grid gap-3">
            {drafts.map((draft, index) => (
              <div
                className="grid gap-3 rounded-2xl border border-[rgba(59,94,69,0.12)] bg-white/80 p-4"
                key={draft.id}
              >
                <div className={styles.subTypeFieldsRow}>
                  <div className={styles.subTypeNameColumn}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Name</label>
                      <input
                        aria-label="Sub-type name"
                        className={styles.select}
                        onChange={(event) =>
                          updateDraft(draft.id, { name: event.target.value })
                        }
                        type="text"
                        value={draft.name}
                      />
                    </div>
                    <div className={styles.subTypeActionsRow}>
                      <button
                        className="rounded-xl border border-[var(--border)] px-3 py-2 font-semibold"
                        disabled={index === 0}
                        onClick={() => moveDraft(draft.id, -1)}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        className="rounded-xl border border-[var(--border)] px-3 py-2 font-semibold"
                        disabled={index === drafts.length - 1}
                        onClick={() => moveDraft(draft.id, 1)}
                        type="button"
                      >
                        Move down
                      </button>
                      <button
                        className="rounded-xl border border-[rgba(157,43,43,0.28)] px-3 py-2 font-semibold text-[#9D2B2B]"
                        onClick={() => removeDraft(draft.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Color</label>
                    <ColorSwatches
                      onChange={(color) => updateDraft(draft.id, { color })}
                      value={draft.color}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Enabled</label>
                    <select
                      aria-label="Sub-type status"
                      className={styles.select}
                      onChange={(event) =>
                        updateDraft(draft.id, {
                          enabled: event.target.value === "true",
                        })
                      }
                      value={draft.enabled ? "true" : "false"}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <div className={styles.actionsRow}>
              <button
                className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold"
                onClick={addDraft}
                type="button"
              >
                Add sub-type
              </button>
              <button
                className="rounded-xl bg-[var(--green)] px-4 py-2 font-semibold text-white transition hover:opacity-90"
                disabled={saveMutation.isPending || !isDirty}
                onClick={() => saveMutation.mutate(drafts)}
                type="button"
              >
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
