import { appendChangeLogs, visibleEntityId } from "@/lib/change-log";
import {
  createOverviewRequirementPayload,
  projectKeyFromSegments,
  readOverview,
  writeOverview,
} from "@/lib/projects";
import { OverviewRequirementInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as OverviewRequirementInput;
    const overview = await readOverview(key);
    const requirement = createOverviewRequirementPayload(input, overview);
    const nextOverview = {
      ...overview,
      requirements: [requirement, ...overview.requirements],
    };
    await writeOverview(key, nextOverview);
    await appendChangeLogs(key, [
      {
        entityType: "demand",
        ...visibleEntityId(requirement),
        action: "demand_created",
        content: demandContent(requirement),
      },
    ]);
    return Response.json({ requirement }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

function demandContent(requirement: { product: string; simple_requirements: string[]; remark: string }) {
  return [requirement.product, ...requirement.simple_requirements, requirement.remark]
    .filter(Boolean)
    .join(" ");
}
