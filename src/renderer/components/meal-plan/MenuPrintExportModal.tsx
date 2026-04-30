import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, Printer, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { exportMenu, fetchJson } from "@/lib/api";
import { getPlatform, type MenuPdfExportResult } from "@/lib/platform";
import {
  buildMenuDocument,
  formatMenuAsHtml,
  type MenuDocument,
} from "@shared/menu-export";
import type { MealPayload, MenuExportFormat, MenuLayout } from "@shared/types";

type MenuExportSelection = MenuExportFormat | "pdf";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LAYOUT_OPTIONS: Array<{
  value: MenuLayout;
  label: string;
  description: string;
}> = [
  {
    value: "classic-grid",
    label: "Classic grid",
    description: "Day sections with meal type groupings.",
  },
  {
    value: "compact-list",
    label: "Compact list",
    description: "Dense day-by-day printout.",
  },
  {
    value: "card",
    label: "Card style",
    description: "Richer menu with meal notes.",
  },
  {
    value: "restaurant",
    label: "Restaurant style",
    description: "Polished short-range menu.",
  },
];

const FORMAT_OPTIONS: Array<{ value: MenuExportSelection; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "markdown", label: "Markdown" },
  { value: "csv", label: "CSV" },
  { value: "html", label: "HTML" },
];

type MenuPrintExportModalProps = {
  initialFrom: Date;
  initialTo: Date;
  onClose: () => void;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toRangeIso(value: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0
    )
  ).toISOString();
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "meal-plan-menu"
  );
}

function buildPdfFileName(document: MenuDocument) {
  return `${toSlug(document.title)}-${document.from}-to-${document.to}.pdf`;
}

function MenuPreview({ document }: { document: MenuDocument }) {
  return (
    <div className={`menu-print-root menu-print-${document.layout}`}>
      <header className="menu-print-header">
        <p>
          {document.days[0]?.label ?? document.from} -{" "}
          {document.days.at(-1)?.label ?? document.to}
        </p>
        <h2>{document.title}</h2>
      </header>
      <div className="menu-print-days">
        {document.days.map((day) => (
          <section className="menu-print-day" key={day.key}>
            <header>
              <p>{day.weekday}</p>
              <h3>{day.label}</h3>
            </header>
            <div className="menu-print-meals">
              {day.meals.length ? (
                day.meals.map((meal) => (
                  <article className="menu-print-meal" key={meal.id}>
                    <span>{meal.mealTypeLabel}</span>
                    <h4>{meal.name}</h4>
                    {meal.description &&
                    (document.layout === "card" ||
                      document.layout === "restaurant") ? (
                      <p>{meal.description}</p>
                    ) : null}
                    {meal.notes && document.layout === "card" ? (
                      <p>Notes: {meal.notes}</p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="menu-print-empty">No meals planned.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MenuPrintExportModal({
  initialFrom,
  initialTo,
  onClose,
}: MenuPrintExportModalProps) {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [from, setFrom] = useState(() => toDateInputValue(initialFrom));
  const [to, setTo] = useState(() => toDateInputValue(initialTo));
  const [layout, setLayout] = useState<MenuLayout>("classic-grid");
  const [format, setFormat] = useState<MenuExportSelection>("pdf");
  const [includeEmptyDays, setIncludeEmptyDays] = useState(true);
  const [title, setTitle] = useState("Meal Plan Menu");
  const [isExporting, setIsExporting] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fullscreenPanelRef = useRef<HTMLDivElement | null>(null);

  const fromIso = useMemo(() => toRangeIso(from), [from]);
  const toIso = useMemo(() => toRangeIso(to, true), [to]);

  const mealsQuery = useQuery({
    queryKey: ["menu-export-preview", fromIso, toIso],
    enabled: apiReady,
    queryFn: () =>
      fetchJson<{ data: MealPayload[] }>(
        `/api/meals?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      ).then((response) => response.data),
  });

  const menuDocument = useMemo(
    () =>
      buildMenuDocument({
        meals: mealsQuery.data ?? [],
        from: fromIso,
        to: toIso,
        layout,
        includeEmptyDays,
        title,
      }),
    [fromIso, includeEmptyDays, layout, mealsQuery.data, title, toIso]
  );

  useEffect(() => {
    setPortalRoot(globalThis.document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) return;
    const previousOverflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = "hidden";
    globalThis.document.body.classList.add("menu-export-printing");
    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
      globalThis.document.body.classList.remove("menu-export-printing");
    };
  }, [portalRoot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isExporting) return;
      if (isFullscreenPreview) {
        setIsFullscreenPreview(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExporting, isFullscreenPreview, onClose]);

  useEffect(() => {
    if (!portalRoot) return;
    const panel = isFullscreenPreview
      ? fullscreenPanelRef.current
      : panelRef.current;
    if (!panel) return;
    const previousFocus =
      globalThis.document.activeElement instanceof HTMLElement
        ? globalThis.document.activeElement
        : null;
    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const firstTarget =
      panel.querySelector<HTMLElement>("[autofocus]") ??
      getFocusable()[0] ??
      panel;
    firstTarget.focus();

    const tabHandler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (globalThis.document.activeElement === first ||
          globalThis.document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        globalThis.document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", tabHandler);
    return () => {
      window.removeEventListener("keydown", tabHandler);
      previousFocus?.focus();
    };
  }, [isFullscreenPreview, portalRoot]);

  const openFullscreenPreview = () => {
    setError(null);
    setIsFullscreenPreview(true);
  };

  const handlePrint = () => {
    setError(null);
    if (mealsQuery.isLoading) {
      setError("Menu preview is still loading.");
      return;
    }
    if (mealsQuery.isError) {
      setError("Unable to load menu preview for printing.");
      return;
    }
    window.print();
  };

  const handlePdfExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = (await getPlatform().exportMenuPdf({
        htmlContent: formatMenuAsHtml(menuDocument),
        suggestedFileName: buildPdfFileName(menuDocument),
      })) as MenuPdfExportResult;

      if (result.status === "error") {
        setError(result.message);
      }
    } catch (pdfExportError) {
      setError(
        pdfExportError instanceof Error
          ? pdfExportError.message
          : "Unable to export menu."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (format === "pdf") {
      await handlePdfExport();
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const result = await exportMenu({
        from: fromIso,
        to: toIso,
        layout,
        format,
        includeEmptyDays,
        title,
      });
      triggerDownload(result.blob, result.fileName);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to export menu."
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (!portalRoot) return null;

  return createPortal(
    <>
      <div
        className="menu-export-modal fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
        onMouseDown={(event) => {
          if (!isExporting && event.target === event.currentTarget) onClose();
        }}
        role="presentation"
      >
        <div
          aria-label="Print or export menu"
          aria-modal="true"
          className="menu-export-panel flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-card border border-cream-dark bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="print-hidden flex items-start justify-between gap-4 border-b border-cream-dark px-4 py-4 sm:px-5">
            <div>
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
                Menu Export
              </p>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Print or export a menu
              </h2>
            </div>
            <button
              aria-label="Close menu export dialog"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-dark bg-cream text-text-muted transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isExporting}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[360px_1fr]">
            <div className="print-hidden space-y-4 overflow-y-auto border-b border-cream-dark px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
              <label className="grid gap-1 text-sm font-bold text-text">
                Menu title
                <input
                  className="rounded-btn border border-cream-dark px-3 py-2 font-normal"
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-bold text-text">
                  From
                  <input
                    className="rounded-btn border border-cream-dark px-3 py-2 font-normal"
                    onChange={(event) => setFrom(event.target.value)}
                    type="date"
                    value={from}
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-text">
                  To
                  <input
                    className="rounded-btn border border-cream-dark px-3 py-2 font-normal"
                    onChange={(event) => setTo(event.target.value)}
                    type="date"
                    value={to}
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-bold text-text">Layout</p>
                {LAYOUT_OPTIONS.map((option) => (
                  <button
                    className={`rounded-card border px-3 py-2 text-left transition-colors ${layout === option.value ? "border-green bg-green-pale" : "border-cream-dark bg-white hover:border-green-light"}`}
                    key={option.value}
                    onClick={() => setLayout(option.value)}
                    type="button"
                  >
                    <span className="block text-sm font-extrabold text-text">
                      {option.label}
                    </span>
                    <span className="block text-xs leading-5 text-text-muted">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>

              <label className="grid gap-1 text-sm font-bold text-text">
                Download format
                <select
                  className="rounded-btn border border-cream-dark px-3 py-2 font-normal"
                  onChange={(event) =>
                    setFormat(event.target.value as MenuExportSelection)
                  }
                  value={format}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-card border border-cream-dark bg-cream px-3 py-2 text-sm font-bold text-text">
                <input
                  checked={includeEmptyDays}
                  className="h-4 w-4"
                  onChange={(event) =>
                    setIncludeEmptyDays(event.target.checked)
                  }
                  type="checkbox"
                />
                Include days without meals
              </label>

              {error ? (
                <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="menu-export-actions flex flex-wrap gap-2 border-t border-cream-dark pt-4">
                <Button
                  disabled={isExporting || mealsQuery.isLoading}
                  onClick={handlePrint}
                  type="button"
                  variant="outline"
                >
                  <Printer aria-hidden="true" size={16} /> Print
                </Button>
                <Button
                  disabled={isExporting || mealsQuery.isLoading}
                  onClick={openFullscreenPreview}
                  type="button"
                  variant="outline"
                >
                  <Maximize2 aria-hidden="true" size={16} /> Preview
                </Button>
                <Button
                  disabled={isExporting || mealsQuery.isLoading}
                  onClick={handleDownload}
                  type="button"
                >
                  <Download aria-hidden="true" size={16} />{" "}
                  {isExporting ? "Exporting..." : "Download"}
                </Button>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto bg-cream px-4 py-4 sm:px-6">
              {mealsQuery.isLoading ? (
                <div className="print-hidden rounded-card border border-cream-dark bg-white p-6 text-sm text-text-muted">
                  Loading menu preview...
                </div>
              ) : mealsQuery.isError ? (
                <div className="print-hidden rounded-card border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  Unable to load menu preview.
                </div>
              ) : (
                <MenuPreview document={menuDocument} />
              )}
            </div>
          </div>
        </div>
      </div>
      {isFullscreenPreview ? (
        <div
          className="fixed inset-0 z-[520] flex bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (!isExporting && event.target === event.currentTarget) {
              setIsFullscreenPreview(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-label="Fullscreen menu preview"
            aria-modal="true"
            className="mx-auto flex h-full w-full max-w-[1400px] flex-col bg-cream"
            onClick={(event) => event.stopPropagation()}
            ref={fullscreenPanelRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-dark bg-white px-4 py-3 sm:px-6">
              <h3 className="font-serif text-xl font-semibold text-text">
                Previewing {title || "Meal Plan Menu"}
              </h3>
              <div className="menu-export-fullscreen-actions flex flex-wrap items-center gap-2">
                <Button
                  disabled={isExporting || mealsQuery.isLoading}
                  onClick={handlePrint}
                  type="button"
                  variant="outline"
                >
                  <Printer aria-hidden="true" size={16} /> Print
                </Button>
                <Button
                  disabled={isExporting || mealsQuery.isLoading}
                  onClick={handleDownload}
                  type="button"
                >
                  <Download aria-hidden="true" size={16} />{" "}
                  {isExporting ? "Exporting..." : "Download"}
                </Button>
                <Button
                  disabled={isExporting}
                  onClick={() => setIsFullscreenPreview(false)}
                  type="button"
                  variant="outline"
                >
                  Exit Preview
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {mealsQuery.isLoading ? (
                <div className="rounded-card border border-cream-dark bg-white p-6 text-sm text-text-muted">
                  Loading menu preview...
                </div>
              ) : mealsQuery.isError ? (
                <div className="rounded-card border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  Unable to load menu preview.
                </div>
              ) : (
                <MenuPreview document={menuDocument} />
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div aria-hidden="true" className="menu-export-print-surface print-only">
        {mealsQuery.isLoading || mealsQuery.isError ? null : (
          <MenuPreview document={menuDocument} />
        )}
      </div>
    </>,
    portalRoot
  );
}
