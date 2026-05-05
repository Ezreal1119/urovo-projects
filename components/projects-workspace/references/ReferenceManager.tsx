import { useCallback, useEffect, useState } from "react";
import type { ProjectReference, ReferenceBrowseEntry } from "../types";
import { api } from "../api-client";
import { formatBytes, formatDateTimeFull, parentReferencePath } from "../formatters";
import { EmptyState, Overlay, Toast } from "../ui";

export function ReferenceManager({
  browseApiPath,
  referenceApiPath,
  initialCount,
}: {
  browseApiPath: string;
  referenceApiPath: string;
  initialCount: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceCountOverride, setReferenceCountOverride] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const referenceCount = referenceCountOverride ?? initialCount;

  const refreshReferences = useCallback((nextCount?: number) => {
    if (nextCount !== undefined) {
      setReferenceCountOverride(nextCount);
    }
    setRefreshKey((current) => current + 1);
  }, []);

  const updateReferenceCount = useCallback((nextCount?: number) => {
    if (nextCount !== undefined) {
      setReferenceCountOverride(nextCount);
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">References</h3>
            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              {referenceCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Link existing files from this project&apos;s docs folder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowReferences(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            View
          </button>
        </div>
      </div>

      {showPicker ? (
        <ReferencePickerDialog
          browseApiPath={browseApiPath}
          referenceApiPath={referenceApiPath}
          onClose={() => setShowPicker(false)}
          onChanged={refreshReferences}
          onReferenceAdded={showToast}
        />
      ) : null}

      {showReferences ? (
        <ReferenceListDialog
          key={refreshKey}
          referenceApiPath={referenceApiPath}
          onClose={() => setShowReferences(false)}
          onChanged={updateReferenceCount}
        />
      ) : null}
      {toast ? <Toast message={toast} /> : null}
    </section>
  );
}

export function ReferencePickerDialog({
  browseApiPath,
  referenceApiPath,
  onClose,
  onChanged,
  onReferenceAdded,
}: {
  browseApiPath: string;
  referenceApiPath: string;
  onClose: () => void;
  onChanged: (nextCount?: number) => void;
  onReferenceAdded: (message: string) => void;
}) {
  const [currentPath, setCurrentPath] = useState("docs");
  const [entries, setEntries] = useState<ReferenceBrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingDocs, setMissingDocs] = useState(false);
  const [error, setError] = useState("");
  const [addingPath, setAddingPath] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{
          currentPath: string;
          entries: ReferenceBrowseEntry[];
          missingDocs: boolean;
        }>(`${browseApiPath}?path=${encodeURIComponent(currentPath)}`);
        if (active) {
          setCurrentPath(data.currentPath);
          setEntries(data.entries);
          setMissingDocs(data.missingDocs);
        }
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEntries();
    return () => {
      active = false;
    };
  }, [browseApiPath, currentPath]);

  async function addReference(entry: ReferenceBrowseEntry) {
    setAddingPath(entry.path);
    setError("");
    try {
      const data = await api<{ references: ProjectReference[] }>(referenceApiPath, {
        method: "POST",
        body: JSON.stringify({ path: entry.path }),
      });
      onChanged(data.references.length);
      onReferenceAdded(`${entry.name} added.`);
    } catch (addError) {
      setError((addError as Error).message);
    } finally {
      setAddingPath("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Add Reference</h2>
            <p className="mt-1 text-sm text-slate-500">{currentPath}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="overflow-auto p-5">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <EmptyState text="Loading docs folder..." />
          ) : missingDocs ? (
            <EmptyState text="No docs folder was found for this project." />
          ) : (
            <div className="space-y-2">
              {currentPath !== "docs" ? (
                <button
                  type="button"
                  onClick={() => setCurrentPath(parentReferencePath(currentPath))}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                  aria-label="Go to parent folder"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-base font-semibold leading-none text-slate-500">
                    ↑
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">
                      Parent folder
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {parentReferencePath(currentPath)}
                    </span>
                  </span>
                </button>
              ) : null}
              {entries.length === 0 ? (
                <EmptyState text="No files found in this docs folder." />
              ) : null}
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  {entry.kind === "directory" ? (
                    <button
                      type="button"
                      onClick={() => setCurrentPath(entry.path)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-slate-950">
                        Folder: {entry.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{entry.path}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {entry.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{entry.path}</span>
                        <span>{formatBytes(entry.size ?? 0)}</span>
                      </div>
                    </div>
                  )}
                  {entry.kind === "file" ? (
                    <button
                      type="button"
                      onClick={() => void addReference(entry)}
                      disabled={addingPath === entry.path}
                      className="shrink-0 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {addingPath === entry.path ? "Adding..." : "Add"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

export function ReferenceListDialog({
  referenceApiPath,
  onClose,
  onChanged,
}: {
  referenceApiPath: string;
  onClose: () => void;
  onChanged: (nextCount?: number) => void;
}) {
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ references: ProjectReference[] }>(referenceApiPath);
        if (active) {
          setReferences(data.references);
          onChanged(data.references.length);
        }
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReferences();
    return () => {
      active = false;
    };
  }, [onChanged, referenceApiPath]);

  async function removeReference(reference: ProjectReference) {
    setRemovingId(reference.id);
    setError("");
    try {
      const data = await api<{ references: ProjectReference[] }>(referenceApiPath, {
        method: "DELETE",
        body: JSON.stringify({ id: reference.id }),
      });
      setReferences(data.references);
      onChanged(data.references.length);
    } catch (removeError) {
      setError((removeError as Error).message);
    } finally {
      setRemovingId("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">References</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${references.length} reference${references.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="overflow-auto p-5">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {loading ? (
            <EmptyState text="Loading references..." />
          ) : references.length === 0 ? (
            <EmptyState text="No local document references yet." />
          ) : (
            <div className="space-y-2">
              {references.map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {reference.name}
                        </div>
                        {!reference.exists ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Missing
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{reference.path}</span>
                        {reference.size ? <span>{formatBytes(reference.size)}</span> : null}
                        {reference.modified_at ? (
                          <span>{formatDateTimeFull(reference.modified_at)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2.5 text-xs font-medium ${
                          reference.exists
                            ? "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            : "pointer-events-none text-slate-300"
                        }`}
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void removeReference(reference)}
                        disabled={removingId === reference.id}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {removingId === reference.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
