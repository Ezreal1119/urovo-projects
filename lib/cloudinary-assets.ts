import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

export type AssetEntityType = "tickets" | "requirements";
export type CloudinaryAsset = {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  secureUrl: string;
  downloadUrl: string;
  previewUrl?: string;
  originalFilename: string;
};

export const MAX_ASSET_BYTES = 100 * 1024 * 1024;

const RESOURCE_TYPES: CloudinaryAsset["resourceType"][] = ["image", "video", "raw"];

type CloudinaryResourceRecord = Record<string, unknown>;

let configured = false;

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.local, then restart the dev server.",
    );
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
}

export function cloudinaryAssetPrefix(
  country: string,
  project: string,
  entityType: AssetEntityType,
  entityUuidOrId: string,
) {
  return [
    "urovo-projects",
    cloudinaryPathSegment(country),
    cloudinaryPathSegment(project),
    entityType,
    cloudinaryPathSegment(entityUuidOrId),
  ].join("/");
}

export async function uploadAsset(file: File, prefix: string): Promise<CloudinaryAsset> {
  configureCloudinary();

  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(`${file.name} is larger than the 100 MB upload limit.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<CloudinaryResourceRecord>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: prefix,
        use_filename: true,
        unique_filename: true,
        filename_override: file.name,
        context: `original_filename=${encodeContextValue(file.name)}`,
        tags: ["urovo-projects"],
      },
      (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }
        if (!uploadResult) {
          reject(new Error("Cloudinary upload did not return a result."));
          return;
        }
        resolve(uploadResult as CloudinaryResourceRecord);
      },
    );
    stream.end(bytes);
  });

  return mapCloudinaryResource(result);
}

export async function listAssets(prefix: string): Promise<CloudinaryAsset[]> {
  configureCloudinary();

  const resources = (
    await Promise.all(RESOURCE_TYPES.map((resourceType) => listAssetsByType(prefix, resourceType)))
  ).flat();

  return resources
    .map(mapCloudinaryResource)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function deleteAssetsByPrefix(prefix: string) {
  configureCloudinary();
  await Promise.all(
    RESOURCE_TYPES.map((resourceType) =>
      cloudinary.api.delete_resources_by_prefix(prefix, {
        resource_type: resourceType,
        type: "upload",
        invalidate: true,
      }),
    ),
  );
}

export async function deleteAsset(
  prefix: string,
  publicId: string,
  resourceType: CloudinaryAsset["resourceType"],
) {
  configureCloudinary();

  if (!publicId.startsWith(`${prefix}/`)) {
    throw new Error("Asset does not belong to this record.");
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "upload",
    invalidate: true,
  });
}

async function listAssetsByType(prefix: string, resourceType: CloudinaryAsset["resourceType"]) {
  const resources: CloudinaryResourceRecord[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await cloudinary.api.resources({
      resource_type: resourceType,
      type: "upload",
      prefix,
      max_results: 100,
      context: true,
      tags: true,
      next_cursor: nextCursor,
    });
    resources.push(
      ...(Array.isArray(response.resources)
        ? (response.resources as CloudinaryResourceRecord[])
        : []),
    );
    nextCursor = response.next_cursor;
  } while (nextCursor);

  return resources;
}

function mapCloudinaryResource(resource: CloudinaryResourceRecord): CloudinaryAsset {
  const resourceType = pickResourceType(resource.resource_type);
  return {
    publicId: String(resource.public_id || ""),
    resourceType,
    type: String(resource.type || "upload"),
    format: String(resource.format || ""),
    bytes: Number(resource.bytes || 0),
    width: Number.isFinite(resource.width) ? Number(resource.width) : undefined,
    height: Number.isFinite(resource.height) ? Number(resource.height) : undefined,
    createdAt: String(resource.created_at || ""),
    secureUrl: String(resource.secure_url || ""),
    downloadUrl: downloadUrl(resourceType, String(resource.public_id || "")),
    previewUrl: previewUrl(resourceType, String(resource.public_id || "")),
    originalFilename: originalFilename(resource),
  };
}

function previewUrl(resourceType: CloudinaryAsset["resourceType"], publicId: string) {
  if (!publicId || resourceType === "raw") {
    return undefined;
  }

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    secure: true,
    width: resourceType === "video" ? 360 : 320,
    height: resourceType === "video" ? 202 : 240,
    crop: "fill",
    format: resourceType === "video" ? "jpg" : undefined,
  });
}

function downloadUrl(resourceType: CloudinaryAsset["resourceType"], publicId: string) {
  if (!publicId) {
    return "";
  }

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    secure: true,
    flags: "attachment",
  });
}

function originalFilename(resource: CloudinaryResourceRecord) {
  const context = resource.context;
  if (context && typeof context === "object") {
    const custom = "custom" in context && typeof context.custom === "object" ? context.custom : context;
    const original = (custom as Record<string, unknown>).original_filename;
    if (typeof original === "string" && original.trim()) {
      return original;
    }
  }

  if (typeof resource.original_filename === "string" && resource.original_filename.trim()) {
    return resource.original_filename;
  }

  const publicId = String(resource.public_id || "");
  return publicId.split("/").at(-1) || `asset-${randomUUID()}`;
}

function pickResourceType(value: unknown): CloudinaryAsset["resourceType"] {
  return value === "image" || value === "video" || value === "raw" ? value : "raw";
}

function cloudinaryPathSegment(value: string) {
  const segment = value.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
  return segment || "unknown";
}

function encodeContextValue(value: string) {
  return value.replace(/([=|\\])/g, "\\$1");
}
