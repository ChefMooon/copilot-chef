"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { type CustomPersonaPayload } from "@/lib/api";

import styles from "./settings.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[autofocus]") ?? getFocusable()[0] ?? panel;
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
  }, [portalRoot]);

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

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={styles.personaModalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      ref={overlayRef}
    >
      <div
        className={`${styles.personaModalPanel} flex max-h-[90vh] w-full max-w-[min(520px,94vw)] flex-col overflow-hidden`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit persona" : "Create custom persona"}
        tabIndex={-1}
      >
        <div className={`${styles.personaModalHeader} flex-shrink-0`}>
          <div className={styles.personaModalHeading}>
            <span className={styles.personaModalEyebrow}>Chef Persona</span>
            <span className={styles.personaModalTitle}>
              {isEditing ? "Edit Persona" : "Create Custom Persona"}
            </span>
          </div>
          <button
            className={styles.personaModalClose}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={`${styles.personaModalBody} flex-1 overflow-y-auto`}>
          <div className={styles.personaFormGroup}>
            <label className={styles.personaFormLabel}>Emoji</label>
            <input
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

        <div className={`${styles.personaModalFooter} flex-shrink-0`}>
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
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
            <button
              className={styles.personaModalBtnSave}
              disabled={!isValid || isSaving || isDeleting}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
