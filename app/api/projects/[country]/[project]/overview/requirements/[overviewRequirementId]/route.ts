import {
  projectKeyFromSegments,
  readOverview,
  updateOverviewRequirementPayload,
  writeOverview,
} from "@/lib/projects";
import { OverviewRequirementInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; overviewRequirementId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, overviewRequirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as OverviewRequirementInput;
    const overview = await readOverview(key);
    const index = overview.requirements.findIndex(
      (requirement) => requirement.id === overviewRequirementId,
    );
    if (index === -1) {
      return Response.json({ error: "Overview requirement not found." }, { status: 404 });
    }

    const requirement = updateOverviewRequirementPayload(
      overview.requirements[index],
      input,
      overview,
    );
    const nextOverview = {
      ...overview,
      requirements: overview.requirements.toSpliced(index, 1, requirement),
    };
    await writeOverview(key, nextOverview);
    return Response.json({ requirement });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, overviewRequirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const overview = await readOverview(key);
    const nextRequirements = overview.requirements.filter(
      (requirement) => requirement.id !== overviewRequirementId,
    );
    if (nextRequirements.length === overview.requirements.length) {
      return Response.json({ error: "Overview requirement not found." }, { status: 404 });
    }

    await writeOverview(key, { ...overview, requirements: nextRequirements });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
