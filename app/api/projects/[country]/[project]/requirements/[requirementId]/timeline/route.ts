import {
  createRequirementTimelinePayload,
  projectKeyFromSegments,
  readRequirements,
  sortRequirements,
  sortRequirementTimeline,
  updateRequirementPayload,
  writeRequirements,
} from "@/lib/projects";
import { RequirementTimelineInput } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string; requirementId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { country, project, requirementId } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = (await request.json()) as RequirementTimelineInput;
    const requirements = await readRequirements(key);
    const index = requirements.findIndex((requirement) => requirement.id === requirementId);
    if (index === -1) {
      return Response.json({ error: "Requirement not found." }, { status: 404 });
    }

    const timelineItem = createRequirementTimelinePayload(input);
    const requirement = updateRequirementPayload(requirements[index], {
      timeline: [...requirements[index].timeline, timelineItem].sort(sortRequirementTimeline),
    });
    const nextRequirements = requirements.toSpliced(index, 1, requirement).sort(sortRequirements);
    await writeRequirements(key, nextRequirements);
    return Response.json({ timelineItem, requirement }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
