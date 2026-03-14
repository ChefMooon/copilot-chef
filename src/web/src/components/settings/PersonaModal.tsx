"use client";

import { useEffect, useRef, useState } from "react";

import { type CustomPersonaPayload } from "@/lib/api";

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

  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    };

    window.addEventListener("keydown", handleKey);
    overlayRef.current?.addEventListener("mousedown", handleClick);
    const overlayEl = overlayRef.current;

    return () => {
      window.removeEventListener("keydown", handleKey);
      overlayEl?.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

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
    <div className={styles.personaModalOverlay} ref={overlayRef}>
      <div className={styles.personaModalPanel}>
        <div className={styles.personaModalHeader}>
          <span className={styles.personaModalTitle}>
            {isEditing ? "Edit persona" : "Create custom persona"}
          </span>
          <button
            className={styles.personaModalClose}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={styles.personaModalBody}>
          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>Emoji</label>
            <input
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
              className={styles.personaPromptTextarea}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how this chef should talk, what they emphasize, their tone..."
              rows={5}
              value={prompt}
            />
          </div>

          {error && <p className={styles.personaModalError}>{error}</p>}
        </div>

        <div className={styles.personaModalFooter}>
          <button
            className={styles.personaModalBtnCancel}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <div className={styles.personaModalFooterRight}>
            {isEditing && onDelete && (
              <button
                className={styles.personaModalBtnDelete}
                disabled={isDeleting || isSaving}
                onClick={() => void handleDelete()}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            )}
            <button
              className={styles.personaModalBtnSave}
              disabled={!isValid || isSaving || isDeleting}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
