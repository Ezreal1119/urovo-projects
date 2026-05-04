import { appendChangeLogs, visibleEntityId } from "@/lib/change-log";
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

    const existingRequirement = overview.requirements[index];
    const requirement = updateOverviewRequirementPayload(
      existingRequirement,
      input,
      overview,
    );
    const nextOverview = {
      ...overview,
      requirements: overview.requirements.toSpliced(index, 1, requirement),
    };
    await writeOverview(key, nextOverview);
    await appendChangeLogs(key, [
      {
        entityType: "demand",
        ...visibleEntityId(requirement),
        action: "demand_updated",
        content: demandContent(requirement),
      },
      ...diffTextList(existingRequirement.linked_requirements, requirement.linked_requirements).added.map(
        (requirementId) => ({
          entityType: "demand" as const,
          ...visibleEntityId(requirement),
          action: "demand_linked_requirement_added" as const,
          content: `Linked requirement ${requirementId}.`,
        }),
      ),
      ...diffTextList(existingRequirement.linked_requirements, requirement.linked_requirements).removed.map(
        (requirementId) => ({
          entityType: "demand" as const,
          ...visibleEntityId(requirement),
          action: "demand_linked_requirement_removed" as const,
          content: `Removed linked requirement ${requirementId}.`,
        }),
      ),
    ]);
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

    const deletedRequirement = overview.requirements.find(
      (requirement) => requirement.id === overviewRequirementId,
    );
    await writeOverview(key, { ...overview, requirements: nextRequirements });
    if (deletedRequirement) {
      await appendChangeLogs(key, [
        {
          entityType: "demand",
          ...visibleEntityId(deletedRequirement),
          action: "demand_deleted",
          content: `Deleted demand [${deletedRequirement.id}]: ${deletedRequirement.product}`,
        },
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

function demandContent(requirement: { product: string; simple_requirements: string[]; remark: string }) {
  return [requirement.product, ...requirement.simple_requirements, requirement.remark]
    .filter(Boolean)
    .join(" ");
}

function diffTextList(before: string[], after: string[]) {
  return {
    added: after.filter((item) => !before.includes(item)),
    removed: before.filter((item) => !after.includes(item)),
  };
}
