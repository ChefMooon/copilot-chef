import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";

import type { RecipeMadeHistoryPayload } from "@shared/types";
import { AuthenticatedImage } from "@/components/ui/AuthenticatedImage";

const PHOTO_ZOOM_MIN = 0.5;
const PHOTO_ZOOM_MAX = 3;
const PHOTO_ZOOM_STEP = 0.25;
const PHOTO_ZOOM_DOUBLE_CLICK = 2;

function clampPhotoZoom(nextZoom: number) {
  if (Number.isNaN(nextZoom)) {
    return 1;
  }

  return Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, Number(nextZoom.toFixed(2))));
}

type RecipeMadeHistoryModalProps = {
  open: boolean;
  recipeTitle: string;
  history: RecipeMadeHistoryPayload | null;
  isLoading?: boolean;
  onClose: () => void;
};

function normalizeMealType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function RecipeMadeHistoryModal({
  open,
  recipeTitle,
  history,
  isLoading = false,
  onClose,
}: RecipeMadeHistoryModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string } | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(1);

  const resetPhotoViewer = () => {
    setActivePhoto(null);
    setPhotoZoom(1);
  };

  const updatePhotoZoom = (nextZoom: number) => {
    setPhotoZoom(clampPhotoZoom(nextZoom));
  };

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) {
      resetPhotoViewer();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activePhoto) {
          event.preventDefault();
          resetPhotoViewer();
          return;
        }

        onClose();
        return;
      }

      if (!activePhoto) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        updatePhotoZoom(photoZoom + PHOTO_ZOOM_STEP);
      }

      if (event.key === "-") {
        event.preventDefault();
        updatePhotoZoom(photoZoom - PHOTO_ZOOM_STEP);
      }

      if (event.key === "0") {
        event.preventDefault();
        updatePhotoZoom(1);
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [activePhoto, onClose, open, photoZoom]);

  useEffect(() => {
    if (!open || !history) {
      return;
    }

    setFromDate("");
    setToDate("");
    setSortOrder("desc");
  }, [history, open]);

  const photoZoomPercent = Math.round(photoZoom * 100);

  const filteredEntries = useMemo(() => {
    const entries = history?.entries ?? [];

    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        if (Number.isNaN(entryDate.getTime())) {
          return false;
        }

        if (from && entryDate < from) {
          return false;
        }

        if (to && entryDate > to) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftTime = new Date(left.date).getTime();
        const rightTime = new Date(right.date).getTime();

        return sortOrder === "desc" ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [fromDate, history?.entries, sortOrder, toDate]);

  if (!open || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 px-3 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label="Recipe made history"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[18px] border border-cream-dark bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-cream-dark p-4">
          <div>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
              Cooking History
            </p>
            <h2 className="mt-1 font-serif text-[1.6rem] font-bold leading-tight text-text">
              {recipeTitle}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {history?.madeCount ?? 0} time{(history?.madeCount ?? 0) === 1 ? "" : "s"} made
              {history?.lastMadeAt ? ` · Last made ${new Date(history.lastMadeAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <button
            className="rounded-full border border-cream-dark bg-cream px-3 py-1 text-sm font-semibold text-text-muted hover:border-green-light hover:text-green"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="border-b border-cream-dark bg-cream/45 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
              From
              <input
                className="mt-1 w-full rounded-md border border-cream-dark bg-white px-2 py-1.5 text-sm"
                onChange={(event) => setFromDate(event.target.value)}
                type="date"
                value={fromDate}
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
              To
              <input
                className="mt-1 w-full rounded-md border border-cream-dark bg-white px-2 py-1.5 text-sm"
                onChange={(event) => setToDate(event.target.value)}
                type="date"
                value={toDate}
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
              Sort
              <select
                className="mt-1 w-full rounded-md border border-cream-dark bg-white px-2 py-1.5 text-sm"
                onChange={(event) =>
                  setSortOrder(event.target.value === "asc" ? "asc" : "desc")
                }
                value={sortOrder}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-text-muted">Loading made history...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-text-muted">No made entries in this date range.</p>
          ) : (
            <ul className="space-y-3">
              {filteredEntries.map((entry) => (
                <li
                  className="rounded-[14px] border border-cream-dark bg-white p-3 shadow-sm"
                  key={entry.mealId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text">{new Date(entry.date).toLocaleDateString()}</p>
                      <p className="text-xs text-text-muted">
                        {normalizeMealType(entry.mealType)} · {entry.mealName}
                      </p>
                    </div>
                    <span className="rounded-chip border border-green/15 bg-green-pale px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] text-green">
                      {normalizeMealType(entry.mealType)}
                    </span>
                  </div>
                  {entry.photoUrl || entry.photoDataUrl ? (
                    <div className="relative mt-2">
                      <button
                        aria-label="Open full photo"
                        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream-dark bg-white/95 text-text-muted shadow-sm transition-colors hover:border-green-light hover:text-green"
                        onClick={() => {
                          setActivePhoto({
                            src: entry.photoUrl ?? entry.photoDataUrl ?? "",
                            alt: entry.photoFileName ?? `${entry.mealName} photo`,
                          });
                          setPhotoZoom(1);
                        }}
                        type="button"
                      >
                        <Maximize2 aria-hidden="true" size={14} />
                      </button>
                      <AuthenticatedImage
                        alt={entry.photoFileName ?? `${entry.mealName} photo`}
                        className="h-40 w-full rounded-md border border-cream-dark bg-cream object-contain p-1 sm:h-48"
                        src={entry.photoUrl ?? entry.photoDataUrl ?? ""}
                      />
                    </div>
                  ) : null}
                  {entry.notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{entry.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {activePhoto ? (
        <div
          aria-label="Cooking history photo viewer backdrop"
          className="fixed inset-0 z-[560] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-6"
          style={{ WebkitAppRegion: "no-drag" }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              resetPhotoViewer();
            }
          }}
        >
          <div
            aria-label="Cooking history photo viewer"
            aria-modal="true"
            className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[18px] border border-cream-dark bg-white shadow-2xl"
            style={{ WebkitAppRegion: "no-drag" }}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div
              className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-cream-dark bg-cream/70 px-3 py-3 sm:px-4"
              style={{ WebkitAppRegion: "no-drag" }}
            >
              <div>
                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
                  Meal Photo
                </p>
                <p className="mt-0.5 text-sm text-text-muted">Use zoom controls or scroll to inspect details.</p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  aria-label="Zoom out"
                  className="flex h-8 min-w-8 items-center justify-center rounded-md border border-cream-dark bg-white px-2 text-sm font-semibold text-text-muted transition-colors hover:border-green-light hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={photoZoom <= PHOTO_ZOOM_MIN}
                  onClick={() => updatePhotoZoom(photoZoom - PHOTO_ZOOM_STEP)}
                  type="button"
                >
                  -
                </button>
                <button
                  aria-label="Reset zoom"
                  className="flex w-16 shrink-0 items-center justify-center rounded-md border border-cream-dark bg-cream px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] tabular-nums text-text transition-colors hover:border-green-light hover:text-green"
                  onClick={() => updatePhotoZoom(1)}
                  type="button"
                >
                  {photoZoomPercent}%
                </button>
                <button
                  aria-label="Zoom in"
                  className="flex h-8 min-w-8 items-center justify-center rounded-md border border-cream-dark bg-white px-2 text-sm font-semibold text-text-muted transition-colors hover:border-green-light hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={photoZoom >= PHOTO_ZOOM_MAX}
                  onClick={() => updatePhotoZoom(photoZoom + PHOTO_ZOOM_STEP)}
                  type="button"
                >
                  +
                </button>
                <button
                  aria-label="Close viewer"
                  className="rounded-full border border-cream-dark bg-cream px-3 py-1 text-sm font-semibold text-text-muted transition-colors hover:border-green-light hover:text-green"
                  onClick={resetPhotoViewer}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div
              aria-label="Cooking history photo canvas"
              className="relative z-0 flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[linear-gradient(180deg,rgba(245,240,232,0.72),rgba(245,240,232,0.28))] p-3 sm:p-6"
              style={{ WebkitAppRegion: "no-drag" }}
              onDoubleClick={() => {
                if (photoZoom > 1) {
                  updatePhotoZoom(1);
                  return;
                }

                updatePhotoZoom(PHOTO_ZOOM_DOUBLE_CLICK);
              }}
              onWheel={(event) => {
                event.preventDefault();
                updatePhotoZoom(photoZoom + (event.deltaY < 0 ? PHOTO_ZOOM_STEP : -PHOTO_ZOOM_STEP));
              }}
            >
              <div
                className="rounded-[16px] border border-cream-dark bg-white p-2 shadow-lg transition-transform duration-150 ease-out"
                style={{ transform: `scale(${photoZoom})` }}
              >
                <AuthenticatedImage
                  alt={activePhoto.alt}
                  className="max-h-[82vh] max-w-[88vw] rounded-[10px] bg-cream object-contain"
                  src={activePhoto.src}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    portalRoot
  );
}
