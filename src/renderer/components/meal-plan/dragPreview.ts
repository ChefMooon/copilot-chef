import styles from "./meal-plan.module.css";

function attachDragPreview(
  preview: HTMLDivElement,
  dataTransfer: DataTransfer,
  offsetX: number,
  offsetY: number
): void {
  document.body.appendChild(preview);

  if (typeof dataTransfer.setDragImage === "function") {
    dataTransfer.setDragImage(preview, offsetX, offsetY);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      preview.remove();
    });
  });
}

export function isInsertAfterPointer(clientY: number, rect: DOMRect): boolean {
  return clientY > rect.top + rect.height / 2;
}

export function showSlotDragPreview(
  dataTransfer: DataTransfer,
  content: {
    title: string;
    namesLine: string;
    metaLine: string;
  }
): void {
  const preview = document.createElement("div");
  preview.className = styles.slotDragPreview;

  const heading = document.createElement("div");
  heading.className = styles.slotDragPreviewTitle;
  heading.textContent = content.title;

  const names = document.createElement("div");
  names.className = styles.slotDragPreviewList;
  names.textContent = content.namesLine;

  const meta = document.createElement("div");
  meta.className = styles.slotDragPreviewMeta;
  meta.textContent = content.metaLine;

  preview.append(heading, names, meta);
  attachDragPreview(preview, dataTransfer, 24, 18);
}

export function showMealDragPreview(
  dataTransfer: DataTransfer,
  content: {
    name: string;
    subTypeName?: string | null;
  }
): void {
  const preview = document.createElement("div");
  preview.className = `${styles.slotDragPreview} ${styles.mealDragPreview}`;

  const heading = document.createElement("div");
  heading.className = styles.slotDragPreviewTitle;
  heading.textContent = content.name;
  preview.append(heading);

  if (content.subTypeName) {
    const meta = document.createElement("div");
    meta.className = styles.slotDragPreviewMeta;
    meta.textContent = content.subTypeName;
    preview.append(meta);
  }

  attachDragPreview(preview, dataTransfer, 16, 16);
}
