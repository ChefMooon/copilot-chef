"use client";

import { useState } from "react";

import { type CustomPersonaPayload } from "@/lib/api";
import { ModalShell } from "@/components/ui/ModalShell";

import styles from "./settings.module.css";

type PersonaModalMode =
  | { mode: "create" }
  | { mode: "edit"; persona: CustomPersonaPayload };

type PersonaModalProps = {
  modalMode: PersonaModalMode;
  onClose: () => void;
  onSave: (input: {
    emoji: string;
    title: string;
    description: string;
    prompt: string;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

export function PersonaModal({
  modalMode,
  onClose,
  onSave,
  onDelete,
}: PersonaModalProps) {
  const existing = modalMode.mode === "edit" ? modalMode.persona : null;

  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const isValid =
    emoji.trim() && title.trim() && description.trim() && prompt.trim();

  const handleSave = async () => {
    if (!isValid) return;
    setError(undefined);
    setIsSaving(true);
    try {
      await onSave({
        emoji: emoji.trim(),
        title: title.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save persona.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || modalMode.mode !== "edit") return;
    setError(undefined);
    setIsDeleting(true);
    try {
      await onDelete(modalMode.persona.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete persona."
      );
      setIsDeleting(false);
    }
  };

  const isEditing = modalMode.mode === "edit";

  return (
    <ModalShell
      ariaLabel={isEditing ? "Edit persona" : "Create custom persona"}
      bodyClassName={`${styles.personaModalBody} flex-1 min-h-0 overflow-y-auto`}
      className={`${styles.personaModalPanel} max-h-[90vh] min-h-0 w-full max-w-[min(520px,94vw)]`}
      closeLabel="Close persona dialog"
      closeDisabled={isSaving || isDeleting}
      onClose={onClose}
      open
      eyebrow="Chef Persona"
      title={isEditing ? "Edit Persona" : "Create Custom Persona"}
      footerLeft={
        <button
          className={styles.personaModalBtnCancel}
          disabled={isSaving || isDeleting}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      }
      footerRight={
        <>
          {isEditing && onDelete ? (
            <button
              className={styles.personaModalBtnDelete}
              disabled={isDeleting || isSaving}
              onClick={() => void handleDelete()}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
          <button
            className={styles.personaModalBtnSave}
            disabled={!isValid || isSaving || isDeleting}
            onClick={() => void handleSave()}
            type="button"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>Emoji</label>
            <input
              aria-label="Emoji"
              autoFocus
              className={styles.personaEmojiInput}
              maxLength={2}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🍳"
              type="text"
              value={emoji}
            />
          </div>

          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>Name</label>
            <input
              aria-label="Name"
              className={styles.textInput}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Grillmaster"
              type="text"
              value={title}
            />
          </div>

          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>Tagline</label>
            <input
              aria-label="Tagline"
              className={styles.textInput}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bold, smoky, and confident"
              type="text"
              value={description}
            />
          </div>

          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>
              Personality instructions
            </label>
            <textarea
              aria-label="Personality instructions"
              className={styles.personaPromptTextarea}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how this chef should talk, what they emphasize, their tone..."
              rows={5}
              value={prompt}
            />
          </div>

          {error && <p className={styles.personaModalError}>{error}</p>}
    </ModalShell>
  );
}
