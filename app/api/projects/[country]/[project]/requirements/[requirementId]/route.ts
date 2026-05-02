import {
  projectKeyFromSegments,
  readRequirements,
  sortRequirements,
  updateRequirementPayload,
  writeRequirements,
} from "@/lib/projects";
import { RequirementInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string; requirementId: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as RequirementInput;
    const requirements = await readRequirements(key);
    const index = requirements.findIndex((requirement) => requirement.id === requirementId);
    if (index === -1) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    const updated = updateRequirementPayload(requirements[index], input);
    const nextRequirements = requirements.toSpliced(index, 1, updated).sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    return Response.json({ requirement: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const requirements = await readRequirements(key);
    const nextRequirements = requirements.filter((requirement) => requirement.id !== requirementId);
    if (nextRequirements.length === requirements.length) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    await writeRequirements(key, nextRequirements);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
