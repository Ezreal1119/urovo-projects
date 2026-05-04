import { cloudinaryAssetPrefix, deleteAssetsByPrefix } from "@/lib/cloudinary-assets";
import { appendChangeLogs, visibleEntityId } from "@/lib/change-log";
import {
  projectKeyFromSegments,
  readOverview,
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

    const existingRequirement = requirements[index];
    const updated = updateRequirementPayload(existingRequirement, input);
    const nextRequirements = requirements.toSpliced(index, 1, updated).sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    await appendChangeLogs(key, [
      {
        entityType: "requirement",
        ...visibleEntityId(updated),
        action: "requirement_updated",
        content: requirementContent(updated),
      },
      ...diffTextList(existingRequirement.related_tickets, updated.related_tickets).added.map(
        (ticketId) => ({
          entityType: "requirement" as const,
          ...visibleEntityId(updated),
          action: "requirement_linked_ticket_added" as const,
          content: `Linked ticket ${ticketId}.`,
        }),
      ),
      ...diffTextList(existingRequirement.related_tickets, updated.related_tickets).removed.map(
        (ticketId) => ({
          entityType: "requirement" as const,
          ...visibleEntityId(updated),
          action: "requirement_linked_ticket_removed" as const,
          content: `Removed linked ticket ${ticketId}.`,
        }),
      ),
    ]);
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
    const requirement = requirements.find((current) => current.id === requirementId);
    const nextRequirements = requirements.filter((requirement) => requirement.id !== requirementId);
    if (nextRequirements.length === requirements.length) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    const linkedOverviewRequirements = (await readOverview(key)).requirements
      .filter((requirement) => requirement.linked_requirements.includes(requirementId))
      .map((requirement) => ({
        id: requirement.id,
        product: requirement.product,
        remark: requirement.remark,
      }));

    if (linkedOverviewRequirements.length > 0) {
      return Response.json(
        {
          code: "REQUIREMENT_LINKED_TO_OVERVIEW",
          error: "Requirement is linked to one or more overview items.",
          overviewRequirements: linkedOverviewRequirements,
        },
        { status: 409 },
      );
    }

    await deleteAssetsByPrefix(
      cloudinaryAssetPrefix(country, project, "requirements", requirement?.uuid || requirementId),
    );
    await writeRequirements(key, nextRequirements);
    if (requirement) {
      await appendChangeLogs(key, [
        {
          entityType: "requirement",
          ...visibleEntityId(requirement),
          action: "requirement_deleted",
          content: `Deleted requirement [${requirement.id}]: ${requirement.title}`,
        },
      ]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

function requirementContent(requirement: { title: string; details: string }) {
  return [requirement.title, requirement.details].filter(Boolean).join(" ");
}

function diffTextList(before: string[], after: string[]) {
  return {
    added: after.filter((item) => !before.includes(item)),
    removed: before.filter((item) => !after.includes(item)),
  };
}
