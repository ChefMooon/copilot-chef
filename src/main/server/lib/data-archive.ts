import { createHash } from "node:crypto";

import { unzipSync, zipSync } from "fflate";

import {
  DATA_ARCHIVE_LAYOUT,
  getDataArchiveAssetMimeType,
  isCanonicalArchiveEntryPath,
  isMealPhotoArchivePath,
  type ArchiveValidationErrorCode,
} from "@shared/schemas/data-management-schemas";

export const DEFAULT_DATA_ARCHIVE_LIMITS = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntries: 512,
  maxUncompressedBytes: 128 * 1024 * 1024,
  maxAssetBytes: 8 * 1024 * 1024,
  maxAssetCount: 100,
} as const;

export type DataArchiveLimits = {
  [Key in keyof typeof DEFAULT_DATA_ARCHIVE_LIMITS]?: number;
};

export type DataArchiveEntry = {
  path: string;
  data: Uint8Array;
};

export type DataArchiveExtractionOptions = {
  limits?: DataArchiveLimits;
  checksums?: Readonly<Record<string, string>>;
};

export class DataArchiveError extends Error {
  readonly code: ArchiveValidationErrorCode;
  readonly entryPath: string | undefined;

  constructor(
    code: ArchiveValidationErrorCode,
    message: string,
    entryPath?: string
  ) {
    super(message);
    this.name = "DataArchiveError";
    this.code = code;
    this.entryPath = entryPath;
  }
}

function limitsWithDefaults(limits?: DataArchiveLimits) {
  return {
    ...DEFAULT_DATA_ARCHIVE_LIMITS,
    ...limits,
  };
}

function isAssetPath(path: string) {
  return path.startsWith(`${DATA_ARCHIVE_LAYOUT.assets.mealPhotos}/`);
}

function validateEntryPath(path: string) {
  if (!isCanonicalArchiveEntryPath(path)) {
    if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
      throw new DataArchiveError(
        "PATH_TRAVERSAL",
        `Unsafe archive entry path: ${path}`,
        path
      );
    }

    throw new DataArchiveError(
      isAssetPath(path) ? "UNSUPPORTED_ASSET_TYPE" : "UNKNOWN_ENTRY",
      `Archive entry is outside the canonical layout: ${path}`,
      path
    );
  }

  if (isAssetPath(path) && !isMealPhotoArchivePath(path)) {
    throw new DataArchiveError(
      "UNSUPPORTED_ASSET_TYPE",
      `Unsupported archive asset type: ${path}`,
      path
    );
  }
}

function checkEntryLimits(
  entries: readonly DataArchiveEntry[],
  limits: ReturnType<typeof limitsWithDefaults>
) {
  if (entries.length > limits.maxEntries) {
    throw new DataArchiveError(
      "TOO_MANY_ENTRIES",
      `Archive contains ${entries.length} entries; maximum is ${limits.maxEntries}`
    );
  }

  if (!entries.some((entry) => entry.path === DATA_ARCHIVE_LAYOUT.manifest)) {
    throw new DataArchiveError(
      "MISSING_ENTRY",
      `Archive must contain ${DATA_ARCHIVE_LAYOUT.manifest}`
    );
  }

  let uncompressedBytes = 0;
  let assetCount = 0;
  for (const entry of entries) {
    validateEntryPath(entry.path);
    uncompressedBytes += entry.data.byteLength;

    if (isAssetPath(entry.path)) {
      assetCount += 1;
      if (entry.data.byteLength > limits.maxAssetBytes) {
        throw new DataArchiveError(
          "ASSET_TOO_LARGE",
          `Asset exceeds the ${limits.maxAssetBytes}-byte limit`,
          entry.path
        );
      }
    }
  }

  if (assetCount > limits.maxAssetCount) {
    throw new DataArchiveError(
      "TOO_MANY_ASSETS",
      `Archive contains ${assetCount} assets; maximum is ${limits.maxAssetCount}`
    );
  }

  if (uncompressedBytes > limits.maxUncompressedBytes) {
    throw new DataArchiveError(
      "ARCHIVE_TOO_LARGE",
      `Archive contents exceed the ${limits.maxUncompressedBytes}-byte limit`
    );
  }
}

export function sha256Hex(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

export function createDataArchive(
  inputEntries: readonly DataArchiveEntry[],
  options: { limits?: DataArchiveLimits } = {}
) {
  const limits = limitsWithDefaults(options.limits);
  const seenPaths = new Set<string>();
  const entries = [...inputEntries].sort((left, right) =>
    left.path.localeCompare(right.path)
  );

  for (const entry of entries) {
    if (seenPaths.has(entry.path)) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        `Duplicate archive entry: ${entry.path}`,
        entry.path
      );
    }
    seenPaths.add(entry.path);
  }

  checkEntryLimits(entries, limits);

  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    files[entry.path] = entry.data;
  }

  const archive = Buffer.from(zipSync(files, { level: 6 }));
  if (archive.byteLength > limits.maxArchiveBytes) {
    throw new DataArchiveError(
      "ARCHIVE_TOO_LARGE",
      `Compressed archive exceeds the ${limits.maxArchiveBytes}-byte limit`
    );
  }

  return archive;
}

function readUint16(data: Uint8Array, offset: number) {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data: Uint8Array, offset: number) {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

function findEndOfCentralDirectory(data: Uint8Array) {
  const minimumOffset = Math.max(0, data.byteLength - 22 - 0xffff);
  for (
    let offset = data.byteLength - 22;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (readUint32(data, offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new DataArchiveError(
    "INVALID_ARCHIVE",
    "ZIP end-of-directory record is missing"
  );
}

type InspectedArchiveEntry = {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
};

function inspectZip(
  data: Uint8Array,
  limits: ReturnType<typeof limitsWithDefaults>
) {
  const endOffset = findEndOfCentralDirectory(data);
  const diskNumber = readUint16(data, endOffset + 4);
  const centralDirectoryDisk = readUint16(data, endOffset + 6);
  const entriesOnDisk = readUint16(data, endOffset + 8);
  const entryCount = readUint16(data, endOffset + 10);
  const centralDirectorySize = readUint32(data, endOffset + 12);
  const centralDirectoryOffset = readUint32(data, endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount > limits.maxEntries ||
    centralDirectoryOffset + centralDirectorySize > endOffset
  ) {
    throw new DataArchiveError(
      "INVALID_ARCHIVE",
      "Unsupported or malformed ZIP directory"
    );
  }

  const entries: InspectedArchiveEntry[] = [];
  const seenPaths = new Set<string>();
  let offset = centralDirectoryOffset;
  let uncompressedBytes = 0;
  let assetCount = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > data.byteLength ||
      readUint32(data, offset) !== 0x02014b50
    ) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        "Malformed ZIP central directory"
      );
    }

    const flags = readUint16(data, offset + 8);
    const compressionMethod = readUint16(data, offset + 10);
    const compressedSize = readUint32(data, offset + 20);
    const uncompressedSize = readUint32(data, offset + 24);
    const nameLength = readUint16(data, offset + 28);
    const extraLength = readUint16(data, offset + 30);
    const commentLength = readUint16(data, offset + 32);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;

    if (entryEnd > data.byteLength || (flags & 0x1) !== 0) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        "Encrypted ZIP entries are not supported"
      );
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        "ZIP64 entries are not supported"
      );
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        "Unsupported ZIP compression method"
      );
    }

    let path: string;
    try {
      path = new TextDecoder("utf-8", { fatal: true }).decode(
        data.subarray(offset + 46, offset + 46 + nameLength)
      );
    } catch {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        "ZIP entry name is not valid UTF-8"
      );
    }

    validateEntryPath(path);
    if (seenPaths.has(path)) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        `Duplicate archive entry: ${path}`,
        path
      );
    }
    seenPaths.add(path);

    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > limits.maxUncompressedBytes) {
      throw new DataArchiveError(
        "ARCHIVE_TOO_LARGE",
        `Archive contents exceed the ${limits.maxUncompressedBytes}-byte limit`
      );
    }

    if (isAssetPath(path)) {
      assetCount += 1;
      if (assetCount > limits.maxAssetCount) {
        throw new DataArchiveError(
          "TOO_MANY_ASSETS",
          `Archive contains more than ${limits.maxAssetCount} assets`
        );
      }
      if (uncompressedSize > limits.maxAssetBytes) {
        throw new DataArchiveError(
          "ASSET_TOO_LARGE",
          `Asset exceeds the ${limits.maxAssetBytes}-byte limit`,
          path
        );
      }
      const extension = path.slice(path.lastIndexOf(".") + 1);
      if (!getDataArchiveAssetMimeType(extension)) {
        throw new DataArchiveError(
          "UNSUPPORTED_ASSET_TYPE",
          `Unsupported archive asset type: ${path}`,
          path
        );
      }
    }

    entries.push({ path, compressedSize, uncompressedSize, compressionMethod });
    offset = entryEnd;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw new DataArchiveError(
      "INVALID_ARCHIVE",
      "ZIP central directory size is inconsistent"
    );
  }

  return entries;
}

export function extractDataArchive(
  input: Uint8Array,
  options: DataArchiveExtractionOptions = {}
) {
  const limits = limitsWithDefaults(options.limits);
  if (input.byteLength > limits.maxArchiveBytes) {
    throw new DataArchiveError(
      "ARCHIVE_TOO_LARGE",
      `Archive exceeds the ${limits.maxArchiveBytes}-byte limit`
    );
  }

  const inspectedEntries = inspectZip(input, limits);
  const unzipped = unzipSync(input);
  const extracted = new Map<string, Buffer>();

  for (const entry of inspectedEntries) {
    const data = unzipped[entry.path];
    if (!data || data.byteLength !== entry.uncompressedSize) {
      throw new DataArchiveError(
        "INVALID_ARCHIVE",
        `ZIP entry could not be extracted: ${entry.path}`,
        entry.path
      );
    }

    extracted.set(entry.path, Buffer.from(data));
  }

  for (const [path, expectedChecksum] of Object.entries(
    options.checksums ?? {}
  )) {
    const data = extracted.get(path);
    if (!data || !/^[a-f0-9]{64}$/.test(expectedChecksum)) {
      throw new DataArchiveError(
        "CHECKSUM_MISMATCH",
        `Missing checksum target: ${path}`,
        path
      );
    }
    if (sha256Hex(data) !== expectedChecksum) {
      throw new DataArchiveError(
        "CHECKSUM_MISMATCH",
        `Checksum mismatch for archive entry: ${path}`,
        path
      );
    }
  }

  return extracted;
}

export const createArchive = createDataArchive;
export const extractArchive = extractDataArchive;
