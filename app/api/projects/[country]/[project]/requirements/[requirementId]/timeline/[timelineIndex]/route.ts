import {
  projectKeyFromSegments,
  readRequirements,
  sortRequirements,
  sortRequirementTimeline,
  updateRequirementPayload,
  updateRequirementTimelinePayload,
  writeRequirements,
} from "@/lib/projects";
import { RequirementTimelineInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ country: string; project: string; requirementId: string; timelineIndex: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const { country, project, requirementId, timelineIndex } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as RequirementTimelineInput;
    const requirements = await readRequirements(key);
    const requirementIndex = requirements.findIndex((requirement) => requirement.id === requirementId);
    if (requirementIndex === -1) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    const index = Number(timelineIndex);
    const timeline = requirements[requirementIndex].timeline;
    if (!Number.isInteger(index) || index < 0 || index >= timeline.length) {
      return Response.json({ error: "Timeline update not found." }, { status: 404 });
    }

    const timelineItem = updateRequirementTimelinePayload(timeline[index], input);
    const requirement = updateRequirementPayload(requirements[requirementIndex], {
      timeline: timeline.toSpliced(index, 1, timelineItem).sort(sortRequirementTimeline),
    });
    const nextRequirements = requirements.toSpliced(requirementIndex, 1, requirement).sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    return Response.json({ timelineItem, requirement });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { country, project, requirementId, timelineIndex } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const requirements = await readRequirements(key);
    const requirementIndex = requirements.findIndex((requirement) => requirement.id === requirementId);
    if (requirementIndex === -1) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    const index = Number(timelineIndex);
    const timeline = requirements[requirementIndex].timeline;
    if (!Number.isInteger(index) || index < 0 || index >= timeline.length) {
      return Response.json({ error: "Timeline update not found." }, { status: 404 });
    }

    const requirement = updateRequirementPayload(requirements[requirementIndex], {
      timeline: timeline.toSpliced(index, 1),
    });
    const nextRequirements = requirements.toSpliced(requirementIndex, 1, requirement).sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    return Response.json({ requirement });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
