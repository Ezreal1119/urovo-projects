import { useEffect, useRef, useState } from "react";
import type { ProjectAsset } from "../types";
import { MAX_ASSET_BYTES } from "../constants";
import { api } from "../api-client";
import { formatBytes, formatDateTimeFull } from "../formatters";
import { Overlay } from "../ui";

export function AssetManager({ assetApiPath }: { assetApiPath: string }) {
  const [showUpload, setShowUpload] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Assets</h3>
          <p className="mt-1 text-xs text-slate-500">
            Images, videos, or supporting files stored in Cloudinary.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setShowAssets(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            View
          </button>
        </div>
      </div>

      {showUpload ? (
        <AssetUploadDialog
          assetApiPath={assetApiPath}
          onClose={() => setShowUpload(false)}
          onUploaded={() => setRefreshKey((current) => current + 1)}
        />
      ) : null}

      {showAssets ? (
        <AssetGalleryDialog
          key={refreshKey}
          assetApiPath={assetApiPath}
          onClose={() => setShowAssets(false)}
        />
      ) : null}
    </section>
  );
}

export function AssetUploadDialog({
  assetApiPath,
  onClose,
  onUploaded,
}: {
  assetApiPath: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [statuses, setStatuses] = useState<
    {
      name: string;
      state: "queued" | "uploading" | "uploaded" | "error";
      message?: string;
    }[]
  >([]);
  const [uploading, setUploading] = useState(false);

  function queueFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || uploading) {
      return;
    }
    void uploadFiles(files);
  }

  async function uploadFiles(files: File[]) {
    setUploading(true);
    setStatuses(files.map((file) => ({ name: file.name, state: "queued" })));

    for (const file of files) {
      if (file.size > MAX_ASSET_BYTES) {
        setStatuses((current) =>
          updateAssetStatus(
            current,
            file.name,
            "error",
            "File is larger than 100 MB.",
          ),
        );
        continue;
      }

      setStatuses((current) =>
        updateAssetStatus(current, file.name, "uploading"),
      );
      const formData = new FormData();
      formData.append("files", file);

      try {
        await api<{ assets: ProjectAsset[] }>(assetApiPath, {
          method: "POST",
          body: formData,
        });
        setStatuses((current) =>
          updateAssetStatus(current, file.name, "uploaded"),
        );
        onUploaded();
      } catch (error) {
        setStatuses((current) =>
          updateAssetStatus(
            current,
            file.name,
            "error",
            (error as Error).message,
          ),
        );
      }
    }

    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Upload Asset</h2>
            <p className="mt-1 text-sm text-slate-500">
              Up to 100 MB per file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            queueFiles(event.dataTransfer.files);
          }}
          className={`grid min-h-40 place-items-center rounded-lg border border-dashed p-6 text-center transition ${
            dragging
              ? "border-slate-500 bg-slate-100"
              : "border-slate-300 bg-slate-50"
          }`}
        >
          <div>
            <div className="text-sm font-semibold text-slate-950">
              Drop assets here
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Images, videos, or other support files.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
            >
              Select Files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  queueFiles(event.target.files);
                }
              }}
            />
          </div>
        </div>

        {statuses.length > 0 ? (
          <div className="mt-4 space-y-2">
            {statuses.map((status) => (
              <div
                key={status.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {status.name}
                </span>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    status.state === "uploaded"
                      ? "text-emerald-700"
                      : status.state === "error"
                        ? "text-red-700"
                        : "text-slate-500"
                  }`}
                  title={status.message}
                >
                  {assetStatusLabel(status)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}

export function AssetGalleryDialog({
  assetApiPath,
  onClose,
}: {
  assetApiPath: string;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPublicId, setDeletingPublicId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ assets: ProjectAsset[] }>(assetApiPath);
        if (active) {
          setAssets(data.assets);
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

    void loadAssets();
    return () => {
      active = false;
    };
  }, [assetApiPath]);

  async function deleteAsset(asset: ProjectAsset) {
    if (!confirm(`Delete ${asset.originalFilename} from Cloudinary?`)) {
      return;
    }

    setDeletingPublicId(asset.publicId);
    setError("");
    try {
      await api<{ ok: true }>(assetApiPath, {
        method: "DELETE",
        body: JSON.stringify({
          publicId: asset.publicId,
          resourceType: asset.resourceType,
        }),
      });
      setAssets((current) =>
        current.filter((currentAsset) => currentAsset.publicId !== asset.publicId),
      );
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingPublicId("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Assets</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${assets.length} asset${assets.length === 1 ? "" : "s"}`}
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
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Loading assets...
            </div>
          ) : null}

          {!loading && !error && assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No assets uploaded yet.
            </div>
          ) : null}

          {!loading && assets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.publicId}
                  asset={asset}
                  deleting={deletingPublicId === asset.publicId}
                  onDelete={() => void deleteAsset(asset)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

export function AssetCard({
  asset,
  deleting,
  onDelete,
}: {
  asset: ProjectAsset;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {asset.resourceType === "image" && asset.previewUrl ? (
        <a
          href={asset.secureUrl}
          target="_blank"
          rel="noreferrer"
          className="block bg-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary account host is configured by env at runtime. */}
          <img
            src={asset.previewUrl}
            alt={asset.originalFilename}
            className="h-44 w-full object-cover"
          />
        </a>
      ) : asset.resourceType === "video" ? (
        <div className="bg-slate-950">
          <video
            src={asset.secureUrl}
            controls
            className="h-44 w-full bg-slate-950 object-contain"
          />
        </div>
      ) : (
        <div className="grid h-44 place-items-center bg-slate-100 px-4 text-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              {asset.format || "file"}
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-medium text-slate-700">
              {asset.originalFilename}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-32 flex-col gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-950">
            {asset.originalFilename}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="shrink-0">{asset.resourceType}</span>
            <span className="shrink-0">{formatBytes(asset.bytes)}</span>
            {asset.createdAt ? (
              <span className="min-w-0 truncate">
                {formatDateTimeFull(asset.createdAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={asset.secureUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          >
            Open
          </a>
          <a
            href={asset.downloadUrl || asset.secureUrl}
            download={asset.originalFilename}
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md bg-slate-950 px-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Download
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function updateAssetStatus(
  statuses: {
    name: string;
    state: "queued" | "uploading" | "uploaded" | "error";
    message?: string;
  }[],
  name: string,
  state: "queued" | "uploading" | "uploaded" | "error",
  message?: string,
) {
  return statuses.map((status) =>
    status.name === name ? { ...status, state, message } : status,
  );
}

export function assetStatusLabel(status: {
  state: "queued" | "uploading" | "uploaded" | "error";
  message?: string;
}) {
  if (status.state === "error") {
    return status.message || "Error";
  }
  if (status.state === "uploaded") {
    return "Uploaded";
  }
  if (status.state === "uploading") {
    return "Uploading...";
  }
  return "Queued";
}
