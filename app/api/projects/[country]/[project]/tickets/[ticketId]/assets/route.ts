import {
  cloudinaryAssetPrefix,
  deleteAsset,
  listAssets,
  MAX_ASSET_BYTES,
  uploadAsset,
  type CloudinaryAsset,
} from "@/lib/cloudinary-assets";
import { projectKeyFromSegments, readTickets } from "@/lib/projects";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; ticketId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const { prefix } = await ticketAssetContext(country, project, ticketId);
    return Response.json({ assets: await listAssets(prefix) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, ticketId } = await context.params;
    const { prefix } = await ticketAssetContext(country, project, ticketId);
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
    const { country, project, ticketId } = await context.params;
    const { prefix } = await ticketAssetContext(country, project, ticketId);
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

async function ticketAssetContext(country: string, project: string, ticketId: string) {
  const key = projectKeyFromSegments([country, project]);
  const tickets = await readTickets(key);
  const ticket = tickets.find((current) => current.id === ticketId);
  if (!ticket) {
    throw new Error("Ticket not found.");
  }

  return {
    prefix: cloudinaryAssetPrefix(country, project, "tickets", ticket.uuid || ticket.id),
  };
}

function isAssetResourceType(value: unknown): value is CloudinaryAsset["resourceType"] {
  return value === "image" || value === "video" || value === "raw";
}
