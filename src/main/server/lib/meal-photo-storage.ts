import { mkdirSync } from "node:fs";
import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { app } from "electron";

const PHOTO_DIR_NAME = "meal-photos";
const DATA_DIR_NAME = "data";
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function getPhotoRootDir() {
  try {
    return join(app.getPath("userData"), DATA_DIR_NAME, PHOTO_DIR_NAME);
  } catch {
    return join(process.cwd(), ".copilot-chef", PHOTO_DIR_NAME);
  }
}

function getExtensionFromMime(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower === "image/jpeg") return "jpg";
  if (lower === "image/png") return "png";
  if (lower === "image/webp") return "webp";
  if (lower === "image/gif") return "gif";
  if (lower === "image/avif") return "avif";
  return "bin";
}

function safeBaseName(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || null;
}

export async function saveMealPhotoDataUrl(input: {
  mealId: string;
  photoDataUrl: string;
  photoFileName?: string | null;
}) {
  const match = DATA_URL_PATTERN.exec(input.photoDataUrl);
  if (!match) {
    throw new Error("Invalid image payload. Expected a base64 data URL.");
  }

  const mimeType = match[1].toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    throw new Error("Image payload is empty.");
  }

  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error("Image payload is too large. Maximum supported size is 8MB.");
  }

  const extension = getExtensionFromMime(mimeType);
  const safeName =
    safeBaseName(input.photoFileName) ?? `${input.mealId}-${Date.now().toString(36)}`;
  const fileName = `${safeName}.${extension}`;

  const root = getPhotoRootDir();
  mkdirSync(root, { recursive: true });

  const relativePath = join(PHOTO_DIR_NAME, fileName);
  const absolutePath = join(root, fileName);

  await writeFile(absolutePath, buffer);

  return {
    photoPath: relativePath.replace(/\\/g, "/"),
    photoMimeType: mimeType,
    photoFileName: input.photoFileName ?? fileName,
  };
}

export async function readMealPhotoFile(photoPath: string) {
  const normalized = photoPath.replace(/^\/+/, "");
  const absolutePath = join(getPhotoRootDir(), normalized.replace(/^meal-photos\//, ""));

  const [fileBuffer, stats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);

  return {
    data: fileBuffer,
    updatedAt: stats.mtime,
  };
}

export async function deleteMealPhotoFile(photoPath: string | null | undefined) {
  if (!photoPath) {
    return;
  }

  const normalized = photoPath.replace(/^\/+/, "");
  const absolutePath = join(getPhotoRootDir(), normalized.replace(/^meal-photos\//, ""));

  try {
    await unlink(absolutePath);
  } catch {
    // Best-effort cleanup.
  }
}
