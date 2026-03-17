"use client";

import { useMemo, useState } from "react";

import { type CreateRecipeInput } from "@copilot-chef/core";

type RecipeFormProps = {
  initialValue?: Partial<CreateRecipeInput>;
  onSubmit: (value: CreateRecipeInput) => Promise<void>;
};

export function RecipeForm({ initialValue, onSubmit }: RecipeFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [servings, setServings] = useState(initialValue?.servings ?? 2);
  const [ingredientsText, setIngredientsText] = useState(
    () =>
      initialValue?.ingredients
        ?.map((item) =>
          [item.quantity ?? "", item.unit ?? "", item.name, item.notes ?? ""]
            .join(" ")
            .trim()
        )
        .join("\n") ?? ""
  );
  const [instructionsText, setInstructionsText] = useState(
    () => initialValue?.instructions?.join("\n") ?? ""
  );
  const [tagsText, setTagsText] = useState(initialValue?.tags?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  const ingredientLines = useMemo(
    () =>
      ingredientsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [ingredientsText]
  );

  const instructionLines = useMemo(
    () =>
      instructionsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [instructionsText]
  );

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        title,
        description,
        servings,
        instructions: instructionLines,
        ingredientLines,
        tags: tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        origin: initialValue?.origin ?? "manual",
      });
      setTitle("");
      setDescription("");
      setIngredientsText("");
      setInstructionsText("");
      setTagsText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Add Recipe</h2>
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Recipe title"
        value={title}
      />
      <textarea
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        rows={2}
        value={description ?? ""}
      />
      <input
        className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
        min={1}
        onChange={(event) => setServings(Number(event.target.value) || 1)}
        type="number"
        value={servings}
      />
      <textarea
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setIngredientsText(event.target.value)}
        placeholder="Ingredients (one per line)"
        rows={6}
        value={ingredientsText}
      />
      <textarea
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setInstructionsText(event.target.value)}
        placeholder="Instructions (one step per line)"
        rows={6}
        value={instructionsText}
      />
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => setTagsText(event.target.value)}
        placeholder="Tags (comma separated)"
        value={tagsText}
      />
      <button
        className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        disabled={saving || !title || instructionLines.length === 0}
        onClick={() => void handleSubmit()}
        type="button"
      >
        {saving ? "Saving..." : "Save recipe"}
      </button>
    </div>
  );
}
