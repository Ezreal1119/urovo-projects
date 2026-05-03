import {
  cloudinaryAssetPrefix,
  deleteAsset,
  listAssets,
  MAX_ASSET_BYTES,
  uploadAsset,
  type CloudinaryAsset,
} from "@/lib/cloudinary-assets";
import { projectKeyFromSegments, readRequirements } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; requirementId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { prefix } = await requirementAssetContext(country, project, requirementId);
    return Response.json({ assets: await listAssets(prefix) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { prefix } = await requirementAssetContext(country, project, requirementId);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "Select at least one asset to upload." }, { status: 400 });
    }

    const tooLarge = files.find((file) => file.size > MAX_ASSET_BYTES);
    if (tooLarge) {
      return Response.json({ error: `${tooLarge.name} is larger than the 100 MB upload limit.` }, { status: 413 });
    }

    const assets = await Promise.all(files.map((file) => uploadAsset(file, prefix)));
    return Response.json({ assets }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const { prefix } = await requirementAssetContext(country, project, requirementId);
    const input = (await request.json()) as Partial<
      Pick<CloudinaryAsset, "publicId" | "resourceType">
    >;

    if (!input.publicId || !isAssetResourceType(input.resourceType)) {
      return Response.json({ error: "Asset publicId and resourceType are required." }, { status: 400 });
    }

    await deleteAsset(prefix, input.publicId, input.resourceType);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

async function requirementAssetContext(country: string, project: string, requirementId: string) {
  const key = projectKeyFromSegments([country, project]);
  const requirements = await readRequirements(key);
  const requirement = requirements.find((current) => current.id === requirementId);
  if (!requirement) {
    throw new Error("Requirement not found.");
  }

  return {
    prefix: cloudinaryAssetPrefix(country, project, "requirements", requirement.uuid || requirement.id),
  };
}

function isAssetResourceType(value: unknown): value is CloudinaryAsset["resourceType"] {
  return value === "image" || value === "video" || value === "raw";
}
