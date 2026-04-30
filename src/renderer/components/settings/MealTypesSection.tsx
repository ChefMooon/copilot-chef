import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMealTypeDefinition,
  createMealTypeProfile,
  deleteMealTypeDefinition,
  deleteMealTypeProfile,
  listMealTypeProfiles,
  reorderMealTypeDefinitions,
  updateMealTypeDefinition,
  updateMealTypeProfile,
  type MealTypeDefinitionPayload,
  type MealTypeProfilePayload,
} from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";
import type {
  CreateMealTypeProfileInput,
  UpdateMealTypeProfileInput,
} from "@shared/types";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { MealTypeProfileModal } from "@/components/settings/MealTypeProfileModal";
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

const profilesQueryKey = ["meal-types", "profiles"] as const;

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
};

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function buildProfileForm(
  profile?: MealTypeProfilePayload | null
): ProfileFormState {
  return {
    id: profile?.id ?? null,
    name: profile?.name ?? "",
    color: profile?.color ?? "#3B5E45",
    description: profile?.description ?? "",
    priority: profile?.priority ?? 0,
    startDate: toDateInputValue(profile?.startDate ?? null),
    endDate: toDateInputValue(profile?.endDate ?? null),
  };
}

function createMealTypeDraftId() {
  return `meal-type-draft-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEditableMealTypeDraft(
  definition?: MealTypeDefinitionPayload,
  options?: { definitionId?: string | null }
): EditableMealTypeDraft {
  return {
    id: createMealTypeDraftId(),
    definitionId: options?.definitionId ?? definition?.id ?? null,
    name: definition?.name ?? "",
    color: definition?.color ?? PRESET_COLORS[0],
    enabled: definition?.enabled ?? true,
  };
}

function buildProfileMealTypeDrafts(
  profile: MealTypeProfilePayload | null | undefined
) {
  const sourceDefinitions = profile?.mealTypes ?? [];

  if (sourceDefinitions.length === 0) {
    return [buildEditableMealTypeDraft()];
  }

  return sourceDefinitions.map((definition) =>
    buildEditableMealTypeDraft(definition, {
      definitionId: profile ? definition.id : null,
    })
  );
}

export function MealTypesSection() {
  const apiReady = isServerConfigReady(getCachedConfig());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false);
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(buildProfileForm());
  const [profileMealTypeDrafts, setProfileMealTypeDrafts] = useState<
    EditableMealTypeDraft[]
  >([]);

  const profilesQuery = useQuery({
    queryKey: profilesQueryKey,
    enabled: apiReady,
    queryFn: listMealTypeProfiles,
  });

  const profiles = profilesQuery.data ?? [];

  const invalidateMealTypes = async () => {
    await queryClient.invalidateQueries({ queryKey: profilesQueryKey });
    await queryClient.invalidateQueries({
      queryKey: ["meal-types"],
      exact: false,
    });
  };

  const saveProfileMutation = useMutation({
    mutationFn: async (input: {
      form: ProfileFormState;
      mealTypeDrafts: EditableMealTypeDraft[];
    }) => {
      const { form, mealTypeDrafts } = input;
      const isCreating = !form.id;
      const existingProfile = form.id
        ? (profiles.find((profile) => profile.id === form.id) ?? null)
        : null;
      const basePayload = {
        name: form.name,
        color: form.color.trim().toUpperCase(),
        description: form.description || null,
        priority: form.priority,
      };
      const payload: CreateMealTypeProfileInput | UpdateMealTypeProfileInput =
        existingProfile?.isDefault
          ? basePayload
          : {
              ...basePayload,
              startDate: form.startDate || null,
              endDate: form.endDate || null,
            };

      const normalizedDrafts = mealTypeDrafts.map((draft) => ({
        ...draft,
        definitionId: isCreating ? null : draft.definitionId,
        name: draft.name.trim(),
        color: draft.color.trim().toUpperCase(),
      }));

      if (normalizedDrafts.length === 0) {
        throw new Error(
          "Add at least one meal type before saving this profile."
        );
      }

      if (normalizedDrafts.some((draft) => !draft.name)) {
        throw new Error(
          "Each meal type needs a name before saving this profile."
        );
      }

      let createdProfileId: string | null = null;

      try {
        const savedProfile = form.id
          ? await updateMealTypeProfile(form.id, payload)
          : await createMealTypeProfile(payload);

        if (isCreating) {
          createdProfileId = savedProfile.id;
        }

        const existingDefinitions = existingProfile?.mealTypes ?? [];
        const removedDefinitionIds = new Set(
          existingDefinitions
            .filter(
              (definition) =>
                !normalizedDrafts.some(
                  (draft) => draft.definitionId === definition.id
                )
            )
            .map((definition) => definition.id)
        );

        for (const definitionId of removedDefinitionIds) {
          await deleteMealTypeDefinition(savedProfile.id, definitionId);
        }

        const orderedIds: string[] = [];

        for (const draft of normalizedDrafts) {
          if (draft.definitionId) {
            await updateMealTypeDefinition(
              savedProfile.id,
              draft.definitionId,
              {
                name: draft.name,
                color: draft.color,
                enabled: draft.enabled,
              }
            );
            orderedIds.push(draft.definitionId);
            continue;
          }

          const createdDefinition = await createMealTypeDefinition(
            savedProfile.id,
            {
              name: draft.name,
              color: draft.color,
              enabled: draft.enabled,
            }
          );
          orderedIds.push(createdDefinition.id);
        }

        if (orderedIds.length > 0) {
          await reorderMealTypeDefinitions(savedProfile.id, orderedIds);
        }

        return savedProfile;
      } catch (error) {
        if (createdProfileId) {
          try {
            await deleteMealTypeProfile(createdProfileId);
          } catch {
            // Best-effort cleanup if post-create sync fails.
          }
        }

        throw error;
      }
    },
    onSuccess: async () => {
      await invalidateMealTypes();
      setProfileForm(buildProfileForm());
      setProfileMealTypeDrafts([]);
      setIsProfileFormOpen(false);
      toast({ title: "Meal type profile saved." });
    },
    onError: (error) => {
      toast({
        title: "Could not save profile.",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: deleteMealTypeProfile,
    onSuccess: async (_result, deletedId) => {
      await invalidateMealTypes();
      if (profileForm.id === deletedId) {
        setProfileForm(buildProfileForm());
        setProfileMealTypeDrafts([]);
        setIsProfileFormOpen(false);
      }
      toast({ title: "Meal type profile deleted." });
    },
    onError: (error) => {
      toast({
        title: "Could not delete profile.",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    },
  });

  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? null;
  const customProfiles = profiles.filter((profile) => !profile.isDefault);

  const openCreateProfileForm = () => {
    setProfileForm(buildProfileForm());
    setProfileMealTypeDrafts(buildProfileMealTypeDrafts(null));
    setIsProfileFormOpen(true);
  };

  const openUpdateProfileForm = (profile: MealTypeProfilePayload) => {
    setProfileForm(buildProfileForm(profile));
    setProfileMealTypeDrafts(buildProfileMealTypeDrafts(profile));
    setIsProfileFormOpen(true);
  };

  const closeProfileForm = () => {
    setProfileForm(buildProfileForm());
    setProfileMealTypeDrafts([]);
    setIsProfileFormOpen(false);
  };

  const addProfileMealTypeDraft = () => {
    setProfileMealTypeDrafts((current) => [
      ...current,
      buildEditableMealTypeDraft(),
    ]);
  };

  const updateProfileMealTypeDraft = (
    draftId: string,
    patch: Partial<Pick<EditableMealTypeDraft, "name" | "color" | "enabled">>
  ) => {
    setProfileMealTypeDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...patch } : draft
      )
    );
  };

  const removeProfileMealTypeDraft = (draftId: string) => {
    setProfileMealTypeDrafts((current) =>
      current.filter((draft) => draft.id !== draftId)
    );
  };

  const moveProfileMealTypeDraft = (draftId: string, direction: -1 | 1) => {
    setProfileMealTypeDrafts((current) => {
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

  return (
    <CollapsibleSection id="meal-types" label="Meal Plans">
      {profilesQuery.isLoading ? (
        <div className={styles.card}>Loading meal type profiles…</div>
      ) : null}

      {defaultProfile ? (
        <div className={styles.card} key={defaultProfile.id}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <span
                className="h-4 w-4 rounded-full border border-white/70"
                style={{ backgroundColor: defaultProfile.color }}
              />
              <h2 className={styles.cardTitle}>{defaultProfile.name}</h2>
              <span className="rounded-full bg-[var(--cream-dark)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Default
              </span>
              <span className="rounded-full bg-[rgba(59,94,69,0.1)] px-3 py-1 text-xs font-semibold text-[var(--green)]">
                Priority {defaultProfile.priority}
              </span>
            </div>
            <p className={styles.cardDescription}>
              {defaultProfile.description || "No description."}
            </p>
            <p className={styles.cardDescription}>
              Applies whenever no dated profile matches.
            </p>
          </div>

          <div className={styles.actionsRow}>
            <button
              className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold"
              onClick={() => openUpdateProfileForm(defaultProfile)}
              type="button"
            >
              Update profile
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>Custom Profiles</h2>
          </div>
          <p className={styles.cardDescription}>
            Create alternate meal type profiles for seasonal routines, diets, or
            events like Ramadan. Higher priority wins when date ranges overlap.
          </p>
        </div>

        {customProfiles.length === 0 && !isProfileFormOpen ? (
          <div className="grid gap-4">
            <div className={styles.cardDescription}>
              No custom meal plan profiles yet.
            </div>
            <div className={styles.actionsRow}>
              <button
                className="rounded-xl bg-[var(--green)] px-4 py-2 font-semibold text-white transition hover:opacity-90"
                onClick={openCreateProfileForm}
                type="button"
              >
                Add custom profile
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              <div className={styles.actionsRow}>
                <button
                  className="rounded-xl bg-[var(--green)] px-4 py-2 font-semibold text-white transition hover:opacity-90"
                  onClick={openCreateProfileForm}
                  type="button"
                >
                  Add custom profile
                </button>
              </div>

              {customProfiles.map((profile) => {
                return (
                  <div className="grid gap-4" key={profile.id}>
                    <div className="grid gap-3 rounded-2xl border border-[rgba(59,94,69,0.12)] bg-white/70 p-4">
                      <div
                        className={styles.cardHeader}
                        style={{ marginBottom: 0 }}
                      >
                        <div className={styles.cardTitleRow}>
                          <span
                            className="h-4 w-4 rounded-full border border-white/70"
                            style={{ backgroundColor: profile.color }}
                          />
                          <h3 className={styles.cardTitle}>{profile.name}</h3>
                          <span className="rounded-full bg-[rgba(59,94,69,0.1)] px-3 py-1 text-xs font-semibold text-[var(--green)]">
                            Priority {profile.priority}
                          </span>
                        </div>
                        <p className={styles.cardDescription}>
                          {profile.description || "No description."}
                        </p>
                        <p className={styles.cardDescription}>
                          {`${profile.startDate?.slice(0, 10) ?? "No start"} to ${profile.endDate?.slice(0, 10) ?? "No end"}`}
                        </p>
                      </div>

                      <div className={styles.actionsRow}>
                        <button
                          className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold"
                          onClick={() => openUpdateProfileForm(profile)}
                          type="button"
                        >
                          Update profile
                        </button>
                        <button
                          className="rounded-xl border border-[rgba(157,43,43,0.28)] px-4 py-2 font-semibold text-[#9D2B2B]"
                          onClick={() =>
                            deleteProfileMutation.mutate(profile.id)
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <MealTypeProfileModal
        form={profileForm}
        isDefaultProfile={Boolean(
          profileForm.id &&
          profiles.find((profile) => profile.id === profileForm.id)?.isDefault
        )}
        isOpen={isProfileFormOpen}
        isSaving={saveProfileMutation.isPending}
        mealTypeDrafts={profileMealTypeDrafts}
        onAddMealType={addProfileMealTypeDraft}
        onClose={closeProfileForm}
        onMoveMealType={moveProfileMealTypeDraft}
        onRemoveMealType={removeProfileMealTypeDraft}
        onSave={() =>
          saveProfileMutation.mutateAsync({
            form: profileForm,
            mealTypeDrafts: profileMealTypeDrafts,
          })
        }
        onUpdateForm={(patch) =>
          setProfileForm((current) => ({ ...current, ...patch }))
        }
        onUpdateMealType={updateProfileMealTypeDraft}
      />
    </CollapsibleSection>
  );
}
