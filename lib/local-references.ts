import { randomUUID } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { beijingNowIsoString } from "./time";
import { projectDir } from "./projects";
import { LocalFileReference } from "./types";

export type LocalReferenceEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size?: number;
  modified_at?: string;
};

export type LocalReferenceView = LocalFileReference & {
  exists: boolean;
  url: string;
};

const DOCS_FOLDER = "docs";

export async function listDocsEntries(key: string, requestedPath: string) {
  const relativePath = normalizeDocsRelativePath(requestedPath || DOCS_FOLDER, {
    allowDocsRoot: true,
  });
  const directoryPath = resolveDocsPath(key, relativePath);

  let directoryStats;
  try {
    directoryStats = await stat(directoryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { currentPath: relativePath, entries: [] as LocalReferenceEntry[], missingDocs: true };
    }
    throw error;
  }

  if (!directoryStats.isDirectory()) {
    throw new Error("Reference browser path must be a directory.");
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const mappedEntries = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const entryPath = toProjectRelativePath(path.posix.join(relativePath, entry.name));
        const entryStats = await stat(resolveDocsPath(key, entryPath));
        return {
          name: entry.name,
          path: entryPath,
          kind: entry.isDirectory() ? "directory" : "file",
          size: entry.isFile() ? entryStats.size : undefined,
          modified_at: entryStats.mtime.toISOString(),
        } satisfies LocalReferenceEntry;
      }),
  );

  return {
    currentPath: relativePath,
    entries: mappedEntries.sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }),
    missingDocs: false,
  };
}

export async function createReference(key: string, requestedPath: string): Promise<LocalFileReference> {
  const referencePath = normalizeDocsRelativePath(requestedPath);
  const filePath = resolveDocsPath(key, referencePath);
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error("Only files can be referenced.");
  }

  return {
    id: randomUUID(),
    path: referencePath,
    name: path.basename(referencePath),
    size: fileStats.size,
    modified_at: fileStats.mtime.toISOString(),
    added_at: beijingNowIsoString(),
  };
}

export async function referencesWithStatus(
  key: string,
  references: LocalFileReference[],
  fileApiPath: string,
): Promise<LocalReferenceView[]> {
  return Promise.all(
    references.map(async (reference) => {
      let exists = false;
      let size = reference.size;
      let modifiedAt = reference.modified_at;
      try {
        const fileStats = await stat(resolveDocsPath(key, reference.path));
        exists = fileStats.isFile();
        if (exists) {
          size = fileStats.size;
          modifiedAt = fileStats.mtime.toISOString();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }

      return {
        ...reference,
        size,
        modified_at: modifiedAt,
        exists,
        url: `${fileApiPath}?path=${encodeURIComponent(reference.path)}`,
      };
    }),
  );
}

export async function readReferenceFile(key: string, requestedPath: string) {
  const referencePath = normalizeDocsRelativePath(requestedPath);
  const filePath = resolveDocsPath(key, referencePath);
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error("Referenced file not found.");
  }

  return {
    name: path.basename(referencePath),
    bytes: await readFile(filePath),
    contentType: contentTypeForPath(referencePath),
  };
}

export function parentDocsPath(currentPath: string) {
  const normalized = normalizeDocsRelativePath(currentPath, { allowDocsRoot: true });
  if (normalized === DOCS_FOLDER) {
    return DOCS_FOLDER;
  }
  const parent = path.posix.dirname(normalized);
  return parent === "." ? DOCS_FOLDER : parent;
}

function normalizeDocsRelativePath(value: string, options: { allowDocsRoot?: boolean } = {}) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const collapsed = path.posix.normalize(normalized || DOCS_FOLDER);
  const withoutTrailingSlash = collapsed.replace(/\/+$/, "") || DOCS_FOLDER;

  if (
    path.posix.isAbsolute(withoutTrailingSlash) ||
    withoutTrailingSlash === "." ||
    withoutTrailingSlash.startsWith("../") ||
    withoutTrailingSlash.includes("/../") ||
    withoutTrailingSlash === ".."
  ) {
    throw new Error("Invalid reference path.");
  }

  if (withoutTrailingSlash !== DOCS_FOLDER && !withoutTrailingSlash.startsWith(`${DOCS_FOLDER}/`)) {
    throw new Error("References must be inside the project docs folder.");
  }

  if (!options.allowDocsRoot && withoutTrailingSlash === DOCS_FOLDER) {
    throw new Error("Select a file inside the project docs folder.");
  }

  return toProjectRelativePath(withoutTrailingSlash);
}

function resolveDocsPath(key: string, referencePath: string) {
  const projectRoot = projectDir(key);
  const docsRoot = path.resolve(projectRoot, DOCS_FOLDER);
  const resolved = path.resolve(projectRoot, referencePath);
  const relative = path.relative(docsRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Reference path escapes the project docs folder.");
  }

  return resolved;
}

function toProjectRelativePath(value: string) {
  return value.split("/").filter(Boolean).join("/");
}

function contentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".apk": "application/vnd.android.package-archive",
    ".csv": "text/csv; charset=utf-8",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".json": "application/json; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
  };
  return types[extension] || "application/octet-stream";
}
