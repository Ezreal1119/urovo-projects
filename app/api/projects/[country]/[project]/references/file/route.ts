import { readReferenceFile } from "@/lib/local-references";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const { searchParams } = new URL(request.url);
    const file = await readReferenceFile(key, searchParams.get("path") || "");
    return new Response(file.bytes, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${encodeHeaderFilename(file.name)}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

function encodeHeaderFilename(value: string) {
  return value.replace(/["\\]/g, "_");
}
