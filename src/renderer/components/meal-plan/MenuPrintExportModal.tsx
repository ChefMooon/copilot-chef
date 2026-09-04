import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ArrowsOut, Printer } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/ModalShell";
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

function addBrowserPrintControls(printWindow: Window, document: MenuDocument) {
  const printDocument = printWindow.document;
  const style = printDocument.createElement("style");
  style.textContent = `
    .menu-print-controls {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin: 0 auto 16px;
      max-width: 980px;
    }
    .menu-print-controls button {
      border: 1px solid #3b5e45;
      border-radius: 6px;
      padding: 8px 12px;
      background: #3b5e45;
      color: #fffdf8;
      font: 600 14px Arial, sans-serif;
    }
    .menu-print-controls button:last-child {
      background: #fffdf8;
      color: #2c2416;
    }
    @media print {
      .menu-print-controls { display: none; }
    }
  `;
  printDocument.head.appendChild(style);

  const controls = printDocument.createElement("div");
  controls.className = "menu-print-controls";
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
  printDocument.title = document.title;
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
  const platform = getPlatform();
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
    globalThis.document.body.classList.add("menu-export-printing");
    return () => {
      globalThis.document.body.classList.remove("menu-export-printing");
    };
  }, [portalRoot]);

  useEffect(() => {
    if (!portalRoot) return;

    const body = globalThis.document.body;
    let printStarted = false;
    const previousOverflow = body.style.overflow;
    const previousHeight = body.style.height;
    const beforePrint = () => {
      printStarted = true;
      body.style.overflow = "visible";
      body.style.height = "auto";
    };
    const afterPrint = () => {
      body.style.overflow = previousOverflow;
      body.style.height = previousHeight;
      printStarted = false;
    };

    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      if (printStarted) afterPrint();
    };
  }, [portalRoot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreenPreview && !isExporting) {
        setIsFullscreenPreview(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExporting, isFullscreenPreview]);

  useEffect(() => {
    if (!portalRoot || !isFullscreenPreview) return;
    const panel = fullscreenPanelRef.current;
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

  const handleClose = () => {
    if (isFullscreenPreview) {
      setIsFullscreenPreview(false);
      return;
    }

    onClose();
  };

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
    if (platform.runtime === "browser") {
      const printWindow = window.open("", "local-recipe-book-menu-print");

      if (!printWindow) {
        setError("The browser blocked the print preview. Please allow popups and try again.");
        return;
      }

      printWindow.document.write(formatMenuAsHtml(menuDocument));
      printWindow.document.close();
      addBrowserPrintControls(printWindow, menuDocument);
      printWindow.focus();
      printWindow.print();
      return;
    }

    window.print();
  };

  const handlePdfExport = async () => {
    if (!platform.capabilities.pdfExport) {
      handlePrint();
      return;
    }

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

  const pdfActionLabel = platform.capabilities.pdfExport
    ? "Download PDF"
    : "Print / Save PDF";

  return (
    <>
      <ModalShell
        ariaLabel="Print or export menu"
        bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        className="menu-export-panel w-full max-w-6xl"
        closeDisabled={isExporting}
        closeLabel="Close menu export dialog"
        footerRight={
          <Button
            disabled={isExporting}
            onClick={handleClose}
            type="button"
            variant="outline"
          >
            Close
          </Button>
        }
        onClose={handleClose}
        open={Boolean(portalRoot)}
        suspended={isFullscreenPreview}
        width="min(1100px, calc(100vw - 2rem))"
        eyebrow="Menu Export"
        title="Print or export a menu"
        overlayClassName="menu-export-modal"
      >
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
            <div className="menu-export-date-range grid gap-3">
              <label className="grid gap-1 text-sm font-bold text-text">
                From
                <input
                  className="w-full min-w-0 rounded-btn border border-cream-dark px-3 py-2 font-normal"
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                  value={from}
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-text">
                To
                <input
                  className="w-full min-w-0 rounded-btn border border-cream-dark px-3 py-2 font-normal"
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
                  aria-pressed={layout === option.value}
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
                    {option.value === "pdf" && !platform.capabilities.pdfExport
                      ? "Print / Save PDF"
                      : option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-card border border-cream-dark bg-cream px-3 py-2 text-sm font-bold text-text">
              <input
                checked={includeEmptyDays}
                className="h-4 w-4"
                onChange={(event) => setIncludeEmptyDays(event.target.checked)}
                type="checkbox"
              />
              Include days without meals
            </label>

            {error ? (
              <p
                className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
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
                <ArrowsOut aria-hidden="true" size={16} /> Preview
              </Button>
              <Button
                disabled={isExporting || mealsQuery.isLoading}
                onClick={handleDownload}
                type="button"
              >
                <Download aria-hidden="true" size={16} />{" "}
                {isExporting ? "Exporting..." : format === "pdf" ? pdfActionLabel : "Download"}
              </Button>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-cream px-4 py-4 sm:px-6">
            {mealsQuery.isLoading ? (
              <div
                className="print-hidden rounded-card border border-cream-dark bg-white p-6 text-sm text-text-muted"
                role="status"
              >
                Loading menu preview...
              </div>
            ) : mealsQuery.isError ? (
              <div
                className="print-hidden rounded-card border border-red-200 bg-red-50 p-6 text-sm text-red-700"
                role="alert"
              >
                Unable to load menu preview.
              </div>
            ) : (
              <MenuPreview document={menuDocument} />
            )}
          </div>
        </div>
      </ModalShell>
      {portalRoot && isFullscreenPreview
        ? createPortal(
            <div
              className="fixed inset-0 z-[1060] flex bg-black/70 backdrop-blur-[2px]"
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
                <div className="menu-export-fullscreen-header flex flex-wrap items-center justify-between gap-3 border-b border-cream-dark bg-white px-4 py-3 sm:px-6">
                  <h3 className="min-w-0 flex-1 font-serif text-xl font-semibold text-text">
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
                      {isExporting ? "Exporting..." : format === "pdf" ? pdfActionLabel : "Download"}
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
                    <div
                      className="rounded-card border border-cream-dark bg-white p-6 text-sm text-text-muted"
                      role="status"
                    >
                      Loading menu preview...
                    </div>
                  ) : mealsQuery.isError ? (
                    <div
                      className="rounded-card border border-red-200 bg-red-50 p-6 text-sm text-red-700"
                      role="alert"
                    >
                      Unable to load menu preview.
                    </div>
                  ) : (
                    <MenuPreview document={menuDocument} />
                  )}
                </div>
              </div>
            </div>,
            portalRoot
          )
        : null}
      {portalRoot
        ? createPortal(
            <div
              aria-hidden="true"
              className="menu-export-print-surface print-only"
            >
              {mealsQuery.isLoading || mealsQuery.isError ? null : (
                <MenuPreview document={menuDocument} />
              )}
            </div>,
            portalRoot
          )
        : null}
    </>
  );
}
