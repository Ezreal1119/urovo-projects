import {
  createRequirementPayload,
  projectKeyFromSegments,
  readRequirements,
  sortRequirements,
  writeRequirements,
} from "@/lib/projects";
import { RequirementInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    return Response.json({ requirements: await readRequirements(key) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as RequirementInput;
    const requirements = await readRequirements(key);
    const requirement = createRequirementPayload(input, requirements);
    const nextRequirements = [requirement, ...requirements].sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    return Response.json({ requirement }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
