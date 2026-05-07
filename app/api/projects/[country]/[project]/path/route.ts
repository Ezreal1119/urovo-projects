import { projectDir, projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({ path: projectDir(key) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
