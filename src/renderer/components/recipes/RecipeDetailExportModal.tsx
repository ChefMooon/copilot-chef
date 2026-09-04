import { useMemo, useState } from "react";

import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { convertIngredient, type UnitMode } from "@/lib/recipe-units";
import { formatFraction } from "@/lib/fractions";
import { getPlatform } from "@/lib/platform";
import type { RecipeIterationPayload, RecipePayload } from "@/lib/api";
import {
  buildRecipeDocument,
  DEFAULT_RECIPE_EXPORT_SELECTION,
  formatRecipeAsCsv,
  formatRecipeAsHtml,
  formatRecipeAsMarkdown,
  type RecipeExportSelection,
} from "@shared/recipe-export";

type RecipeDetailExportModalProps = {
  recipe: RecipePayload;
  servings: number;
  unitMode: UnitMode;
  iterations: RecipeIterationPayload[];
  onClose: () => void;
};

type ExportFormat = "print" | "pdf" | "html" | "markdown" | "csv";

const FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string }> = [
  { value: "print", label: "Print" },
  { value: "pdf", label: "PDF" },
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "csv", label: "CSV" },
];

const GROUPS: Array<{
  key: keyof RecipeExportSelection;
  label: string;
  fields: string;
}> = [
  { key: "description", label: "Description", fields: "Recipe overview" },
  { key: "ingredients", label: "Ingredients", fields: "Grouped quantities and notes" },
  { key: "instructions", label: "Instructions", fields: "Raw ordered steps" },
  { key: "cookNotes", label: "Cook notes", fields: "Personal cooking notes" },
  { key: "basicMetadata", label: "Basic metadata", fields: "Difficulty, cuisine, yield, prep, cook" },
  { key: "sourceTags", label: "Source and tags", fields: "Source label, URL, tags" },
  { key: "personalStatus", label: "Personal and status", fields: "Favourite, rating, origin, last made" },
  { key: "lineage", label: "Lineage", fields: "Compact source and derived references" },
];

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "recipe";
}

function extension(format: ExportFormat): string {
  if (format === "markdown") return "md";
  if (format === "print" || format === "pdf") return "pdf";
  return format;
}

function addBrowserPrintControls(printWindow: Window, title: string) {
  const printDocument = printWindow.document;
  const style = printDocument.createElement("style");
  style.textContent = `
    .recipe-print-controls {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin: 0 auto 16px;
      max-width: 980px;
    }
    .recipe-print-controls button {
      border: 1px solid #3b5e45;
      border-radius: 6px;
      padding: 8px 12px;
      background: #3b5e45;
      color: #fffdf8;
      font: 600 14px Arial, sans-serif;
    }
    .recipe-print-controls button:last-child {
      background: #fffdf8;
      color: #2c2416;
    }
    @media print {
      .recipe-print-controls { display: none; }
    }
  `;
  printDocument.head.appendChild(style);

  const controls = printDocument.createElement("div");
  controls.className = "recipe-print-controls";
  controls.setAttribute("role", "toolbar");

  const printButton = printDocument.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Print";
  printButton.addEventListener("click", () => printWindow.print());

  const closeButton = printDocument.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => printWindow.close());

  controls.append(printButton, closeButton);
  printDocument.body.prepend(controls);
  printDocument.title = title;
}

export function RecipeDetailExportModal({
  recipe,
  servings,
  unitMode,
  iterations,
  onClose,
}: RecipeDetailExportModalProps) {
  const platform = getPlatform();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [selection, setSelection] = useState<RecipeExportSelection>(
    () => ({ ...DEFAULT_RECIPE_EXPORT_SELECTION })
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const document = useMemo(
    () =>
      buildRecipeDocument({
        recipe,
        servings,
        unitMode,
        selection,
        iterations,
        convertQuantity: (quantity, unit, name, mode) =>
          convertIngredient(quantity, unit, name, mode as UnitMode),
        formatQuantity: formatFraction,
      }),
    [iterations, recipe, selection, servings, unitMode]
  );
  const html = useMemo(() => formatRecipeAsHtml(document), [document]);
  const optionalGroupSelected = Object.values(selection).some(Boolean);

  function toggleSelection(key: keyof RecipeExportSelection) {
    setSelection((current) => ({ ...current, [key]: !current[key] }));
    setError(null);
  }

  function printInBrowser() {
    const printWindow = window.open("", "local-recipe-book-recipe-print");
    if (!printWindow) {
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slugify(recipe.title)}.html`);
      setNotice("The browser blocked print preview, so the standalone HTML was downloaded instead.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    addBrowserPrintControls(printWindow, recipe.title);
    printWindow.focus();
    printWindow.print();
  }

  async function handleExport() {
    setError(null);
    setNotice(null);
    if (!optionalGroupSelected) {
      setError("Select at least one content or metadata group before exporting.");
      return;
    }

    if (format === "print" || (format === "pdf" && !platform.capabilities.pdfExport)) {
      printInBrowser();
      return;
    }

    setIsExporting(true);
    try {
      if (format === "pdf") {
        const result = await platform.exportMenuPdf({
          htmlContent: html,
          suggestedFileName: `${slugify(recipe.title)}.pdf`,
        });
        if (result.status === "error") setError(result.message);
        return;
      }

      const content = format === "html" ? html : format === "markdown" ? formatRecipeAsMarkdown(document) : formatRecipeAsCsv(document);
      const mimeType = format === "html" ? "text/html;charset=utf-8" : format === "markdown" ? "text/markdown;charset=utf-8" : "text/csv;charset=utf-8";
      downloadBlob(new Blob([content], { type: mimeType }), `${slugify(recipe.title)}.${extension(format)}`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export recipe.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ModalShell
      ariaLabel="Print or export recipe"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5"
      className="w-full max-w-5xl"
      closeDisabled={isExporting}
      closeLabel="Close recipe export dialog"
      eyebrow="Recipe Export"
      footerRight={<><Button disabled={isExporting} onClick={onClose} type="button" variant="outline">Close</Button><Button autoFocus disabled={isExporting} onClick={() => void handleExport()} type="button" variant="accent">{isExporting ? "Preparing export..." : format === "print" ? "Print" : `Download ${format.toUpperCase()}`}</Button></>}
      onClose={onClose}
      open
      subtitle="Choose the format and recipe sections for this export."
      title={recipe.title}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="space-y-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-text">Format</legend>
            <select aria-label="Export format" className="rounded-btn border border-cream-dark bg-white px-3 py-2 text-sm text-text" onChange={(event) => setFormat(event.target.value as ExportFormat)} value={format}>
              {FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value === "pdf" && !platform.capabilities.pdfExport ? "Print / Save PDF" : option.label}</option>)}
            </select>
          </fieldset>

          <details open>
            <summary className="cursor-pointer text-sm font-bold text-text">Advanced sections</summary>
            <div className="mt-3 grid gap-2" role="group" aria-label="Advanced export sections">
              {GROUPS.map((group) => <label className="flex gap-2 rounded-btn border border-cream-dark bg-white px-3 py-2 text-sm text-text" key={group.key}><input checked={selection[group.key]} onChange={() => toggleSelection(group.key)} type="checkbox" /><span><span className="block font-bold">{group.label}</span><span className="block text-xs text-text-muted">{group.fields}</span></span></label>)}
            </div>
          </details>
          {error ? <p role="alert" className="text-sm font-semibold text-orange">{error}</p> : null}
          {notice ? <p role="status" className="text-sm font-semibold text-green">{notice}</p> : null}
        </div>
        <div className="min-w-0 rounded-card border border-cream-dark bg-white p-4">
          <p className="mb-3 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">Preview</p>
          <div className="max-h-[55vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </ModalShell>
  );
}
