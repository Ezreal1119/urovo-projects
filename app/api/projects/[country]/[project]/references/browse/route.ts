import { listDocsEntries } from "@/lib/local-references";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const { searchParams } = new URL(request.url);
    return Response.json(await listDocsEntries(key, searchParams.get("path") || "docs"));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
